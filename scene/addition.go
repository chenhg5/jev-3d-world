package scene

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"math"
	"strconv"

	"github.com/chenhg5/jev-3d-world"
)

func ValidateCurrent(current *Spec) error {
	if current == nil {
		return fmt.Errorf("current scene is required for additions")
	}
	known := map[string]bool{}
	for _, asset := range assets {
		known[asset.name] = true
	}
	total := 0
	for _, item := range current.Objects {
		if !known[item.Type] || item.Count < 1 || item.Count > 400 {
			return fmt.Errorf("invalid current scene inventory")
		}
		if len(item.Colors) > item.Count {
			return fmt.Errorf("invalid current scene colors")
		}
		for _, color := range item.Colors {
			if !knownObjectColor(color) {
				return fmt.Errorf("invalid current scene colors")
			}
		}
		total += item.Count
	}
	if total >= 400 {
		return fmt.Errorf("scene limit reached: start a new scene (400 objects maximum)")
	}
	return nil
}

// ComposeAddition returns a delta: existing objects are context, never output.
// Environment and manual transforms remain owned by the client.
func (c Composer) ComposeAddition(ctx context.Context, request string, current Spec) (Spec, error) {
	if err := ValidateCurrent(&current); err != nil {
		return Spec{}, err
	}
	if c.Evaluator == nil {
		return Spec{}, fmt.Errorf("choice evaluator is required")
	}
	var seed [4]byte
	if _, err := rand.Read(seed[:]); err != nil {
		return Spec{}, err
	}
	state := map[string]any{
		"request":          request,
		"existing_objects": current.Objects,
		"environment":      current.Environment,
		"rule":             "Append only. Existing objects are already present and must not be recreated. Only select NEW additions from request. Objects mentioned solely as location references are not additions. Preserve existing environment, time of day and objects. Modification, deletion or time-of-day requests alone add nothing.",
	}
	questions := map[string]jevloop.ChoiceQuestion{}
	questions["object_colors"] = jevloop.ChoiceQuestion{
		Instructions: "Does `request` explicitly attach one or more colors to concrete NEW objects being added? A general mood or palette is not an object color.",
		Criteria:     map[string]string{"none": "No new object has an explicit color.", "explicit": "At least one new object has a literal requested color."},
	}
	for _, asset := range assets {
		questions[asset.name+"_count"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf("How many NEW %s objects does `request` ask to ADD to `existing_objects`? %s. Choose 0 if absent, excluded, only a location reference, or only being modified. Never repeat existing objects just because they appear in context. 'Add two' means 2 additional objects; 'make the total five' means max(0,5-existing count). A concrete requested quantity is exact, capped at 20. Unnumbered plural means 2 or 3. A broad requested addition may infer a few defining props, not an entire replacement scene.", asset.name, asset.description),
			Criteria:     asset.counts,
		}
	}
	result, calls, err := c.evaluateBatches(ctx, state, questions)
	if err != nil {
		return Spec{}, err
	}
	delta := Spec{Variant: binary.LittleEndian.Uint32(seed[:]), Objects: []ObjectSpec{}, Model: result.Model,
		ModelCalls: calls, InputTokens: result.Usage.InputTokens, OutputTokens: result.Usage.OutputTokens, Confidence: 1}
	anchors := map[string]string{"none": "No specific existing object is a location reference; choose a free place."}
	if current.ScenePack != "" && current.ScenePack != "standard" {
		description := "The current generated large world as a whole. Use this when the request refers to the city, reserve, castle or main scene rather than a catalog object."
		if current.ScenePack == "ocean_liner" {
			description = "The current ocean liner itself, including its deck and nearby water. Use this for additions requested on, aboard, beside or around the large ship."
		}
		anchors["scene"] = description
	}
	total := 0
	for _, item := range current.Objects {
		anchors[item.Type] = "Existing " + item.Type + " as the location reference, not a new addition."
		total += item.Count
	}
	spatial := map[string]jevloop.ChoiceQuestion{}
	directions := map[string]string{"auto": "Near the reference if there is one; otherwise a suitable free place.", "left": "To the left (negative X).", "right": "To the right (positive X).", "foreground": "In front (positive Z).", "background": "Behind (negative Z).", "around": "Around the reference.", "center": "At the center."}
	for _, asset := range assets {
		answer, ok := result.Answers[asset.name+"_count"]
		count, parseErr := strconv.Atoi(answer.Choice)
		if !ok || parseErr != nil || count < 0 || count > 20 {
			return Spec{}, fmt.Errorf("invalid addition count for %s", asset.name)
		}
		delta.Confidence = math.Min(delta.Confidence, answer.Confidence)
		if count == 0 {
			continue
		}
		delta.Objects = append(delta.Objects, ObjectSpec{Type: asset.name, Count: count, Confidence: answer.Confidence})
		// Jev Choice questions require at least two criteria. An empty standard
		// scene only has `none`, so omit its anchor question and default below.
		// Large procedural worlds expose `scene` as a semantic anchor because
		// their generated geometry is intentionally absent from Objects.
		if len(anchors) > 1 {
			spatial[asset.name+"_anchor"] = jevloop.ChoiceQuestion{
				Instructions: fmt.Sprintf("For NEW %s objects requested by `request`, which existing object type or generated scene is the spatial reference? E.g. 'two trees beside the pond' -> pond; 'people on the large ship' -> scene. No explicit reference -> none. Do not select a reference just because it exists.", asset.name), Criteria: anchors}
		}
		spatial[asset.name+"_placement"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf("Which spatial direction does `request` specify for the NEW %s objects, relative to the named reference or scene center? Default auto. Interpret beside/旁边 as auto, behind/后面 as background, in front/前面 as foreground.", asset.name), Criteria: directions}
		spatial[asset.name+"_requested"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf("Verify this proposed NEW addition against `request` ONLY: %s (%s). Does the user actually ask to ADD this kind of object? A location reference, an existing object, or an instruction to move/resize/rotate it is NOT an addition. Do not infer people/children/animals from trees, furniture or camping. The proposal can be wrong; reject unrelated props.", asset.name, asset.description),
			Criteria:     map[string]string{"add": "The request positively asks to add this object type (or a clear synonym/category that covers it).", "skip": "Not requested as a NEW addition, only mentioned as a location reference, negated, or merely being modified."},
		}
	}
	if len(spatial) == 0 {
		return delta, nil
	}
	positions, calls, err := c.evaluateBatches(ctx, state, spatial)
	if err != nil {
		return Spec{}, err
	}
	delta.ModelCalls += calls
	delta.InputTokens += positions.Usage.InputTokens
	delta.OutputTokens += positions.Usage.OutputTokens
	kept := make([]ObjectSpec, 0, len(delta.Objects))
	for i := range delta.Objects {
		item := &delta.Objects[i]
		verified := positions.Answers[item.Type+"_requested"].Choice
		if verified == "skip" {
			continue
		}
		if verified != "add" {
			return Spec{}, fmt.Errorf("invalid addition verification")
		}
		total += item.Count
		if total > 400 {
			return Spec{}, fmt.Errorf("addition would exceed the 400 object limit")
		}
		anchor := "none"
		if answer, ok := positions.Answers[item.Type+"_anchor"]; ok {
			anchor = answer.Choice
		}
		placement := positions.Answers[item.Type+"_placement"].Choice
		if _, ok := anchors[anchor]; !ok {
			return Spec{}, fmt.Errorf("invalid addition anchor")
		}
		if _, ok := directions[placement]; !ok {
			return Spec{}, fmt.Errorf("invalid addition placement")
		}
		item.Anchor = anchor
		item.Placement = placement
		kept = append(kept, *item)
	}
	delta.Objects = kept
	colorMode := result.Answers["object_colors"].Choice
	if colorMode != "none" && colorMode != "explicit" {
		return Spec{}, fmt.Errorf("invalid addition object color mode")
	}
	if colorMode == "explicit" && len(delta.Objects) > 0 {
		colored, calls, usage, confidence, err := c.applyObjectColors(ctx, state, delta.Objects)
		if err != nil {
			return Spec{}, err
		}
		delta.Objects = colored
		delta.ModelCalls += calls
		delta.InputTokens += usage.InputTokens
		delta.OutputTokens += usage.OutputTokens
		delta.Confidence = math.Min(delta.Confidence, confidence)
	}
	return delta, nil
}
