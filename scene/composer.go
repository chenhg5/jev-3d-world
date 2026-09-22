package scene

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"math"
	"sort"
	"strconv"

	"github.com/chenhg5/jev-3d-world"
)

type ChoiceEvaluator interface {
	EvaluateChoices(context.Context, any, map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, error)
}

type Composer struct {
	Evaluator ChoiceEvaluator
}

type ObjectSpec struct {
	Type       string  `json:"type"`
	Count      int     `json:"count"`
	Placement  string  `json:"placement"`
	Confidence float64 `json:"confidence"`
	Anchor     string  `json:"anchor,omitempty"`
}

type AvatarSpec struct {
	Jacket         string `json:"jacket"`
	Trousers       string `json:"trousers"`
	Accessory      string `json:"accessory"`
	AccessoryColor string `json:"accessoryColor"`
}

// CitySpec is a compact, semantic plan for a large procedural city. Jev picks
// the few dimensions that affect the whole place; the renderer expands them
// into roads, districts and hundreds of buildings without asking the model to
// place every object individually.
type CitySpec struct {
	Archetype  string `json:"archetype"`
	Districts  string `json:"districts"`
	Roads      string `json:"roads"`
	Density    string `json:"density"`
	Skyline    string `json:"skyline"`
	Waterfront string `json:"waterfront"`
	CivicSpace string `json:"civicSpace"`
	Traffic    string `json:"traffic"`
	Landmark   string `json:"landmark"`
}

// WorldSpec is the semantic grammar for non-city large scene families. Values
// are family-specific bounded choices; code expands them into geometry and
// spatial relationships instead of asking Jev for coordinates or raw JSON.
type WorldSpec struct {
	Archetype  string `json:"archetype"`
	Topology   string `json:"topology"`
	Density    string `json:"density"`
	Population string `json:"population"`
	Feature    string `json:"feature"`
	Hazard     string `json:"hazard"`
	Landmark   string `json:"landmark"`
}

type Spec struct {
	Variant      uint32       `json:"variant"`
	Environment  string       `json:"environment"`
	Lighting     string       `json:"lighting"`
	Camera       string       `json:"camera"`
	Composition  string       `json:"composition"`
	Palette      string       `json:"palette"`
	Terrain      string       `json:"terrain"`
	Atmosphere   string       `json:"atmosphere"`
	Moon         string       `json:"moon"`
	Scenery      bool         `json:"scenery"`
	WaterScale   string       `json:"waterScale"`
	ScenePack    string       `json:"scenePack"`
	City         CitySpec     `json:"city"`
	World        WorldSpec    `json:"world"`
	Avatar       AvatarSpec   `json:"avatar"`
	Objects      []ObjectSpec `json:"objects"`
	Model        string       `json:"model"`
	ModelCalls   int          `json:"modelCalls"`
	Confidence   float64      `json:"confidence"`
	InputTokens  int          `json:"inputTokens"`
	OutputTokens int          `json:"outputTokens"`
}

func (c Composer) Compose(ctx context.Context, request string) (Spec, error) {
	var seed [4]byte
	if _, err := rand.Read(seed[:]); err != nil {
		return Spec{}, fmt.Errorf("create scene variation: %w", err)
	}
	return c.ComposeVariant(ctx, request, binary.LittleEndian.Uint32(seed[:]))
}

// ComposeVariant builds a scene with an explicit variation seed. Jev still
// provides the semantic judgment; the seed samples only plausible ambiguous
// choices and lets the renderer vary geometry and placement.
func (c Composer) ComposeVariant(ctx context.Context, request string, variant uint32) (Spec, error) {
	if c.Evaluator == nil {
		return Spec{}, fmt.Errorf("choice evaluator is required")
	}
	intent, err := c.Evaluator.EvaluateChoices(ctx, map[string]string{"request": request}, map[string]jevloop.ChoiceQuestion{
		"scene_pack": {
			Instructions: "Which available procedural scene family best represents the whole world requested in `request`? Choose a large scene family only when it is central to the request. Named story or film references are thematic cues, not requests for an exact reconstruction. A small explicit object composition remains standard.",
			Criteria: map[string]string{
				"standard":      "A normal finite scene, landscape, room, village, single street, town square, station or explicit object composition.",
				"metropolis":    "A modern large city, downtown, GTA-like/open-world urban area, or city center with multiple districts, roads and a skyline.",
				"ocean_liner":   "A giant passenger ship, Titanic-like ocean liner, cruise ship deck or maritime voyage where the vessel is the world.",
				"prehistoric":   "A Jurassic-like dinosaur reserve, lost prehistoric valley, dinosaur jungle or research park across a large natural landscape.",
				"medieval_city": "A large medieval, fantasy-feudal or Game-of-Thrones-like walled city, castle settlement or fortified capital.",
			},
		},
		"scenery": {
			Instructions: "May the scene include additional background woodland? Read `request`. Exact quantities of trees, 'only' inventories, explicit no-trees/no-forest constraints and empty scenes prohibit extra trees. Otherwise a forest / woods / woodland / 森林 / 山林 setting invites background woodland even when specific foreground props are listed.",
			Criteria: map[string]string{
				"natural": "Forest or woodland setting without an exact tree count or restriction; add background trees.",
				"minimal": "Exact tree count, restricted inventory, exclusions, or no requested forest setting. Do not add background trees.",
			},
		},
		"moon_request": {
			Instructions: "Does `request` explicitly ask to SHOW or HIDE a moon in the sky? Extract the literal instruction, do NOT infer a moon from a holiday or atmosphere. '中秋节' and '中秋节，但是是白天' alone are unspecified. '白天也有月亮' explicitly requests a visible moon. A moon gate or a lunar surface is not a moon in the sky.",
			Criteria: map[string]string{
				"explicit":    "Explicitly requests a visible moon, full moon, crescent or moon viewing / 赏月.",
				"excluded":    "Explicitly excludes a visible moon: no moon / 不要月亮 / 无月 / moonless.",
				"unspecified": "No explicit visible-moon instruction. A festival name alone does not count as an explicit moon request.",
			},
		},
		"scene_mode": {
			Instructions: "Does `request` describe a broad scene to furnish, specify an object inventory, or explicitly want no objects? An activity or place name alone is a theme, not an inventory. Negated objects are exclusions, not a positive inventory.",
			Criteria: map[string]string{
				"theme":     "A scene, place or activity without a concrete positive object list: camping, forest campsite, lively town, farm. Infer characteristic props. May exclude some objects.",
				"inventory": "Names concrete objects to include, with or without counts. Preserve this inventory. Includes 'only five trees' or a village with a windmill, pond, tables and five trees.",
				"empty":     "Explicitly wants empty ground or a landscape without any objects.",
			},
		},
	})
	if err != nil {
		return Spec{}, fmt.Errorf("interpret scene request: %w", err)
	}
	mode := intent.Answers["scene_mode"].Choice
	if mode != "theme" && mode != "inventory" && mode != "empty" {
		return Spec{}, fmt.Errorf("invalid scene mode %q", mode)
	}
	moonRequest := intent.Answers["moon_request"].Choice
	if moonRequest != "explicit" && moonRequest != "excluded" && moonRequest != "unspecified" {
		return Spec{}, fmt.Errorf("invalid moon request %q", moonRequest)
	}
	scenePack := intent.Answers["scene_pack"].Choice
	if scenePack != "standard" && scenePack != "metropolis" && scenePack != "ocean_liner" && scenePack != "prehistoric" && scenePack != "medieval_city" {
		return Spec{}, fmt.Errorf("invalid scene pack %q", scenePack)
	}
	questions := globalQuestions()
	selectedAssets := assets
	if scenePack != "standard" {
		packQuestions := cityQuestions()
		if scenePack != "metropolis" {
			packQuestions = worldQuestions(scenePack)
		}
		for name, question := range packQuestions {
			questions[name] = question
		}
		// Buildings, traffic, parks and street furniture are expanded by the
		// procedural city generator. Skipping 224 per-asset questions is the
		// hierarchy that makes city-scale composition fast and bounded.
		selectedAssets = nil
	}
	for _, item := range selectedAssets {
		policy := "If THIS asset type is absent, negated, or only a different subtype is requested, choose 0. Otherwise use the exact quantity attached to THIS type, capped at 20. Never copy a quantity from another object type. An explicitly requested plural of THIS type without a number means 2 or 3, never zero."
		if mode == "theme" {
			policy = "The user gave a broad theme, not a literal inventory. Infer a sparse recognizable scene. Include this asset ONLY if it is a defining element of that activity/place or basic natural scenery. Choose 1 for a focal object or 2–3 for repeated scenery. Choose 0 for optional accessories, unrelated objects, explicit exclusions and redundant subtypes. For unspecified people use person, not every age/gender subtype. For unspecified trees use tree, not every species."
		} else if mode == "empty" {
			policy = "The user explicitly requested no objects. Choose 0."
		}
		questions[item.name+"_count"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf(
				"How many %s objects should APPEAR in the 3D scene described by `request`? This is the desired object quantity, not word frequency. %s Meaning: %s",
				item.name, policy, item.description,
			),
			Criteria: item.counts,
		}
		questions[item.name+"_placement"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf(
				"Assuming %s is selected, does `request` explicitly give its position? Choose that position, otherwise auto. Ignored when count is zero.",
				item.name,
			),
			Criteria: placementCriteria(),
		}
	}
	result, modelCalls, err := c.evaluateBatches(ctx, map[string]any{
		"request":    request,
		"mode":       mode,
		"scene_pack": scenePack,
		"rule":       "Explicitly requested objects and counts take priority. Broad category names must not automatically include every subtype. Coordinates, scale and geometry are handled by code.",
	}, questions)
	if err != nil {
		return Spec{}, err
	}
	answer := func(name string, flexible bool) jevloop.ChoiceAnswer {
		value := result.Answers[name]
		if flexible {
			value = choosePlausible(value, variant, name)
		}
		return value
	}
	spec := Spec{
		Variant:     variant,
		Environment: answer("environment", false).Choice,
		Lighting:    answer("lighting", false).Choice,
		Camera:      answer("camera", true).Choice,
		Composition: answer("composition", true).Choice,
		Palette:     answer("palette", true).Choice,
		Terrain:     answer("terrain", true).Choice,
		Atmosphere:  answer("atmosphere", true).Choice,
		Moon:        answer("moon", false).Choice,
		Scenery:     intent.Answers["scenery"].Choice == "natural",
		WaterScale:  answer("water_scale", false).Choice,
		ScenePack:   scenePack,
		Avatar: AvatarSpec{
			Jacket:         answer("avatar_jacket", true).Choice,
			Trousers:       answer("avatar_trousers", true).Choice,
			Accessory:      answer("avatar_accessory", true).Choice,
			AccessoryColor: answer("avatar_accessory_color", true).Choice,
		},
		Model:        result.Model,
		ModelCalls:   modelCalls + 1,
		InputTokens:  result.Usage.InputTokens + intent.Usage.InputTokens,
		OutputTokens: result.Usage.OutputTokens + intent.Usage.OutputTokens,
		Confidence:   1,
		Objects:      []ObjectSpec{},
	}
	if scenePack == "metropolis" {
		spec.Environment = "city"
		spec.Terrain = "open"
		spec.City = CitySpec{
			Archetype:  answer("city_archetype", true).Choice,
			Districts:  answer("city_districts", true).Choice,
			Roads:      answer("city_roads", true).Choice,
			Density:    answer("city_density", true).Choice,
			Skyline:    answer("city_skyline", true).Choice,
			Waterfront: answer("city_waterfront", false).Choice,
			CivicSpace: answer("city_civic_space", true).Choice,
			Traffic:    answer("city_traffic", true).Choice,
			Landmark:   answer("city_landmark", true).Choice,
		}
	} else if scenePack != "standard" {
		spec.World = WorldSpec{
			Archetype:  answer("world_archetype", true).Choice,
			Topology:   answer("world_topology", true).Choice,
			Density:    answer("world_density", true).Choice,
			Population: answer("world_population", true).Choice,
			Feature:    answer("world_feature", true).Choice,
			Hazard:     answer("world_hazard", false).Choice,
			Landmark:   answer("world_landmark", true).Choice,
		}
		spec.Terrain = "open"
		switch scenePack {
		case "ocean_liner":
			spec.Environment = "ocean"
		case "prehistoric":
			spec.Environment = "forest"
		case "medieval_city":
			spec.Environment = "meadow"
		}
	}
	// Explicit exclusions and the selected time of day override thematic inference.
	// A requested daytime moon is supported, but a holiday alone cannot add one.
	if moonRequest == "excluded" || (moonRequest != "explicit" && spec.Lighting != "night") {
		spec.Moon = "none"
	}
	for _, name := range []string{"environment", "lighting", "camera", "composition", "palette", "terrain", "atmosphere"} {
		spec.Confidence = math.Min(spec.Confidence, answer(name, name != "environment" && name != "lighting").Confidence)
	}
	if scenePack == "metropolis" {
		for _, name := range []string{"city_archetype", "city_districts", "city_roads", "city_density", "city_skyline", "city_waterfront", "city_civic_space", "city_traffic", "city_landmark"} {
			spec.Confidence = math.Min(spec.Confidence, answer(name, name != "city_waterfront").Confidence)
		}
	} else if scenePack != "standard" {
		for _, name := range []string{"world_archetype", "world_topology", "world_density", "world_population", "world_feature", "world_hazard", "world_landmark"} {
			spec.Confidence = math.Min(spec.Confidence, answer(name, name != "world_hazard").Confidence)
		}
	}
	for _, item := range selectedAssets {
		countAnswer := answer(item.name+"_count", false)
		count, err := strconv.Atoi(countAnswer.Choice)
		if err != nil {
			return Spec{}, fmt.Errorf("invalid %s count %q", item.name, countAnswer.Choice)
		}
		spec.Confidence = math.Min(spec.Confidence, countAnswer.Confidence)
		if count == 0 {
			continue
		}
		placementAnswer := answer(item.name+"_placement", true)
		spec.Confidence = math.Min(spec.Confidence, placementAnswer.Confidence)
		spec.Objects = append(spec.Objects, ObjectSpec{
			Type: item.name, Count: count, Placement: placementAnswer.Choice,
			Confidence: math.Min(countAnswer.Confidence, placementAnswer.Confidence),
		})
	}
	return spec, nil
}

func cityQuestions() map[string]jevloop.ChoiceQuestion {
	return map[string]jevloop.ChoiceQuestion{
		"city_archetype": {
			Instructions: "For a large metropolis, which broad urban character best matches `request`? Use the user's cultural, geographic and fictional cues. This controls materials, block proportions and vegetation, not a literal reconstruction.",
			Criteria: map[string]string{
				"atlantic":     "Dense masonry-and-glass North American downtown with strong avenues, older perimeter blocks and a compact business core; suitable for New York-like cues.",
				"coastal_tech": "Contemporary subtropical Asian technology metropolis with broad boulevards, glass towers, landscaped setbacks and clustered supertalls; suitable for Shenzhen-like cues.",
				"sunbelt":      "Wide-road, palm-lined, entertainment-oriented open-world city with mixed low-rise districts and a sharp downtown cluster; suitable for GTA-like fictional cues.",
				"global":       "Neutral international metropolis mixing office towers, apartments, retail podiums and civic space.",
			},
		},
		"city_roads": {
			Instructions: "Which city road structure best fits `request`?",
			Criteria: map[string]string{
				"tight_grid":  "Frequent narrow streets and compact walkable blocks.",
				"avenue_grid": "Regular blocks crossed by several wider avenues.",
				"superblocks": "Large blocks, broad boulevards and landscaped building setbacks.",
				"mixed":       "A central grid that loosens toward surrounding districts.",
			},
		},
		"city_districts": {
			Instructions: "How should the large city be divided into functional districts? Choose the pattern that best reflects the requested place and activities.",
			Criteria: map[string]string{
				"core_ring":       "A dominant office core, a mixed commercial belt and progressively lower residential outer districts.",
				"mixed_quarters":  "Several varied quarters where offices, apartments, shops and leisure uses mix at different scales.",
				"polycentric":     "Multiple business and residential centers distributed across the city, suitable for a broad megacity.",
				"waterfront_axis": "Dense business and cultural districts follow a harbor, river or coastal development axis.",
			},
		},
		"city_density": {
			Instructions: "How dense and extensive should the requested large city feel?",
			Criteria: map[string]string{
				"urban":    "A substantial city with breathing room, parks and medium-rise edges.",
				"dense":    "Continuous urban blocks and a busy high-rise center.",
				"megacity": "Very dense, expansive city fabric with multiple centers and many high-rises.",
			},
		},
		"city_skyline": {
			Instructions: "Which skyline organization best matches `request`?",
			Criteria: map[string]string{
				"single_core": "One dominant central business district fading toward lower edges.",
				"twin_core":   "Two distinct high-rise clusters connected by an urban corridor.",
				"linear":      "A long ridge of towers following a boulevard or coast.",
				"distributed": "Several smaller high-rise clusters across the city.",
			},
		},
		"city_waterfront": {
			Instructions: "What major water relationship is explicitly present or strongly characteristic in `request`? Do not add water to an ordinary inland downtown.",
			Criteria: map[string]string{
				"none":   "No major waterfront is requested or implied.",
				"river":  "A river divides or borders the city, with bridges and embankments.",
				"harbor": "A broad bay, harbor or seafront forms one edge of the city.",
				"canal":  "A narrower urban canal is integrated with streets and public space.",
			},
		},
		"city_civic_space": {
			Instructions: "Which major open-space anchor best fits this city?",
			Criteria: map[string]string{
				"central_park": "A large rectangular green park interrupts the grid.",
				"civic_plaza":  "A hard-surfaced central square framed by landmark buildings.",
				"transit_hub":  "A station concourse and transport interchange organize the center.",
				"promenade":    "A landscaped linear public space follows water or a major avenue.",
			},
		},
		"city_traffic": {
			Instructions: "How much visible street traffic suits the requested city and time?",
			Criteria: map[string]string{
				"light":   "Sparse vehicles and calm streets.",
				"busy":    "Regular cars, buses and active avenues.",
				"intense": "Heavy traffic on most major roads in a crowded megacity.",
			},
		},
		"city_landmark": {
			Instructions: "Which abstract landmark silhouette best supports the requested skyline? Choose a form, not a named copyrighted or real building replica.",
			Criteria: map[string]string{
				"spire":       "A very tall tapered tower with a needle-like crown.",
				"terraced":    "A tall stepped or terraced tower with multiple setbacks.",
				"twin_towers": "A paired landmark tower composition.",
				"observation": "A slender observation tower with an elevated viewing pod.",
			},
		},
	}
}

func globalQuestions() map[string]jevloop.ChoiceQuestion {
	return map[string]jevloop.ChoiceQuestion{
		"avatar_jacket": {
			Instructions: "Choose the explorer's jacket color to suit the setting, weather, lighting and mood in `request`. Prefer visibility against the environment while keeping a coherent outfit.",
			Criteria:     avatarColorCriteria(),
		},
		"avatar_trousers": {
			Instructions: "Choose the explorer's trouser color to suit `request` and coordinate with the jacket. Prefer a practical, contrasting lower-body color.",
			Criteria:     avatarColorCriteria(),
		},
		"avatar_accessory_color": {
			Instructions: "Choose an accent color for the explorer's accessory that coordinates with the scene and outfit in `request`.",
			Criteria:     avatarColorCriteria(),
		},
		"avatar_accessory": {
			Instructions: "Which single wearable accessory best fits an explorer inside the scene described by `request`? Do not default to a backpack. Choose none for ordinary scenes without a practical or thematic reason for an accessory.",
			Criteria: map[string]string{
				"none":     "No accessory; best for ordinary scenes where special travel, weather or activity gear is unnecessary.",
				"backpack": "An outdoor backpack, only when travel, camping, hiking or an expedition makes carried gear useful.",
				"scarf":    "A neck scarf for cold, windy, festive or elegant settings.",
				"cap":      "A simple brimmed cap for sunny, urban or casual settings.",
				"satchel":  "A compact side satchel for town, garden, school or everyday scenes.",
			},
		},
		"water_scale": {
			Instructions: "If a pond or lake is present, what water-body size fits `request`?",
			Criteria:     map[string]string{"small": "Garden pond, small pool, or no stated lake.", "large": "Lake, lakeside retreat / 湖泊 / 湖畔: a broad body of water."},
		},
		"moon": {
			Instructions: "What moon should be visible in the SKY of `request`? This is separate from ground objects and the lunar-surface environment. Honor explicit exclusions, indoor scenes and moonless skies. Infer a full moon for Mid-Autumn Festival / 中秋节 / 赏月, unless explicitly excluded or the scene is explicitly daytime without a requested moon. Other night scenes need a moon only when requested or central to the theme. Default none.",
			Criteria: map[string]string{
				"none":     "No visible moon; ordinary daylight, indoors, moonless or unspecified sky.",
				"full":     "A bright round full moon; full moon, moon viewing or Mid-Autumn Festival.",
				"crescent": "A thin crescent moon, specifically requested as crescent / 弯月 / 月牙.",
			},
		},
		"environment": {
			Instructions: "Which ground environment best matches the requested scene?",
			Criteria: map[string]string{
				"meadow": "Soft green meadow or garden.", "forest": "Dark mossy forest clearing.",
				"snow": "Snow-covered winter terrain.", "desert": "Warm sandy desert terrain.",
				"volcanic": "Dark volcanic rock terrain.", "moon": "Pale extraterrestrial moon terrain.",
				"ocean":  "Open ocean, sea, island or seascape with blue water / 海洋 / 海岛.",
				"coast":  "Sandy coast or beach adjoining the ocean / 海滩 / 海岸.",
				"city":   "Paved urban plaza for streets, modern buildings and trains / 城市.",
				"garden": "Traditional landscaped garden for pavilions and Chinese architecture / 中式园林.",
			},
		},
		"lighting": {
			Instructions: "Which lighting mood best matches the requested scene? Explicit time of day takes priority. For moon viewing / 赏月 / 中秋节 / Mid-Autumn Festival without a stated time, prefer night.",
			Criteria: map[string]string{
				"day": "Clear neutral daylight.", "sunset": "Warm orange sunset light.",
				"night": "Cool moonlit night.", "overcast": "Soft diffuse cloudy light.",
				"neon": "Dark scene with cyan and magenta accent lighting.",
			},
		},
		"camera": {
			Instructions: "Which camera view matches the request? Default to cinematic for an immersive landscape with foreground and distant scenery. Use isometric, eye-level or top-down when explicitly requested.",
			Criteria: map[string]string{
				"isometric": "Elevated three-quarter isometric overview.",
				"cinematic": "Low, wide cinematic angle.",
				"top_down":  "High top-down strategic view.",
				"eye_level": "Human eye-level view inside the scene.",
			},
		},
		"composition": {
			Instructions: "Which overall spatial composition best matches the requested scene?",
			Criteria: map[string]string{
				"central": "One strong central focal area.", "bilateral": "Balanced left and right groups.",
				"circular": "Objects arranged around a center.", "village": "Several small functional clusters.",
				"path": "A foreground-to-background path or journey.", "scattered": "Natural informal scattered placement.",
			},
		},
		"palette": {
			Instructions: "Which named material palette best matches the requested scene?",
			Criteria: map[string]string{
				"natural": "Forest green, wood brown, warm canvas.", "autumn": "Amber, rust, ochre, dark wood.",
				"winter": "Ice blue, white, charcoal, muted canvas.", "desert": "Sand, terracotta, sun-bleached cloth.",
				"mystic": "Deep violet, cyan glow, dark stone.", "mono": "Graphite, silver, white, restrained accents.",
			},
		},
		"terrain": {
			Instructions: "Which terrain shape best supports the requested scene? Choose for visual variety while preserving the environment.",
			Criteria: map[string]string{
				"open":     "Mostly open level ground with a clear silhouette.",
				"rolling":  "Soft rolling mounds and varied elevation.",
				"terraced": "Layered circular terraces around focal areas.",
				"cratered": "Irregular shallow craters and rocky depressions.",
				"islands":  "Several separated raised ground patches.",
			},
		},
		"atmosphere": {
			Instructions: "Which ambient particle or air treatment best matches the scene?",
			Criteria: map[string]string{
				"clear":     "Clean air without visible particles.",
				"mist":      "Low subtle mist across the ground.",
				"stars":     "A visible field of distant stars or sparkling points.",
				"fireflies": "Sparse warm floating lights.",
				"embers":    "Sparse orange drifting sparks or dust motes.",
			},
		},
	}
}

func avatarColorCriteria() map[string]string {
	return map[string]string{
		"ember": "Warm burnt orange-red.", "ochre": "Golden mustard yellow.",
		"moss": "Deep natural forest green.", "ocean": "Clear medium blue.",
		"ice": "Pale cool blue.", "violet": "Rich muted purple.",
		"charcoal": "Dark neutral graphite.", "cream": "Warm off-white.",
		"sand": "Light earthy tan.",
	}
}

func choosePlausible(answer jevloop.ChoiceAnswer, variant uint32, label string) jevloop.ChoiceAnswer {
	if answer.Confidence >= 0.88 || len(answer.Probabilities) < 2 {
		return answer
	}
	maxProbability := 0.0
	for _, probability := range answer.Probabilities {
		maxProbability = math.Max(maxProbability, probability)
	}
	threshold := math.Max(0.08, maxProbability*0.35)
	keys := make([]string, 0, len(answer.Probabilities))
	for choice, probability := range answer.Probabilities {
		if probability >= threshold {
			keys = append(keys, choice)
		}
	}
	if len(keys) < 2 {
		return answer
	}
	sort.Strings(keys)
	total := 0.0
	for _, key := range keys {
		total += answer.Probabilities[key]
	}
	hash := fnv.New64a()
	_, _ = fmt.Fprintf(hash, "%d:%s", variant, label)
	draw := (float64(hash.Sum64()) / float64(^uint64(0))) * total
	for _, key := range keys {
		draw -= answer.Probabilities[key]
		if draw <= 0 {
			answer.Choice = key
			answer.Confidence = answer.Probabilities[key]
			return answer
		}
	}
	return answer
}

func placementCriteria() map[string]string {
	return map[string]string{
		"auto":   "No explicit position; let the scene planner group related objects and avoid occlusion.",
		"center": "At or near the visual center.", "left": "Primarily on the left side.",
		"right": "Primarily on the right side.", "foreground": "Close to the camera.",
		"background": "Toward the far background.", "around": "Distributed around the main focal area.",
		"scattered": "Scattered naturally across available terrain.",
	}
}

func counts(values ...int) map[string]string {
	result := make(map[string]string, len(values))
	for _, value := range values {
		if value == 0 {
			result["0"] = "Do not include this asset."
		} else {
			result[strconv.Itoa(value)] = fmt.Sprintf("Include %d.", value)
		}
	}
	return result
}
