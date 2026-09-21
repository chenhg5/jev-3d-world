package scene

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	"github.com/chenhg5/jev-3d-world"
)

type fakeEvaluator struct{}

func (fakeEvaluator) EvaluateChoices(
	_ context.Context,
	_ any,
	questions map[string]jevloop.ChoiceQuestion,
) (jevloop.ChoiceResult, error) {
	answers := make(map[string]jevloop.ChoiceAnswer, len(questions))
	for name, question := range questions {
		choice := ""
		for candidate := range question.Criteria {
			choice = candidate
			break
		}
		answers[name] = jevloop.ChoiceAnswer{Choice: choice, Confidence: 0.8}
	}
	answers["environment"] = jevloop.ChoiceAnswer{Choice: "forest", Confidence: 0.9}
	answers["scene_mode"] = jevloop.ChoiceAnswer{Choice: "inventory", Confidence: 0.9}
	answers["moon_request"] = jevloop.ChoiceAnswer{Choice: "unspecified", Confidence: 0.9}
	answers["lighting"] = jevloop.ChoiceAnswer{Choice: "sunset", Confidence: 0.9}
	answers["camera"] = jevloop.ChoiceAnswer{Choice: "isometric", Confidence: 0.9}
	answers["composition"] = jevloop.ChoiceAnswer{Choice: "central", Confidence: 0.9}
	answers["palette"] = jevloop.ChoiceAnswer{Choice: "natural", Confidence: 0.9}
	for _, item := range assets {
		answers[item.name+"_count"] = jevloop.ChoiceAnswer{Choice: "0", Confidence: 0.9}
		answers[item.name+"_placement"] = jevloop.ChoiceAnswer{Choice: "around", Confidence: 0.9}
	}
	answers["tent_count"] = jevloop.ChoiceAnswer{Choice: "2", Confidence: 0.85}
	return jevloop.ChoiceResult{
		Model: "test", Answers: answers, Usage: jevloop.Usage{InputTokens: 42},
	}, nil
}

func TestCatalogCoversExactCounts(t *testing.T) {
	for _, item := range assets {
		for count := 0; count <= 20; count++ {
			if _, ok := item.counts[strconv.Itoa(count)]; !ok {
				t.Fatalf("%s cannot represent %d requested objects", item.name, count)
			}
		}
	}
}

type fiveTreeEvaluator struct{ t *testing.T }

func (f fiveTreeEvaluator) EvaluateChoices(ctx context.Context, state any, questions map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, error) {
	if question, exists := questions["tree_count"]; exists {
		if _, ok := question.Criteria["5"]; !ok {
			f.t.Fatal("generic trees or exact count five missing from Jev choices")
		}
	}
	result, err := (fakeEvaluator{}).EvaluateChoices(ctx, state, questions)
	result.Answers["tent_count"] = jevloop.ChoiceAnswer{Choice: "0", Confidence: 1}
	result.Answers["tree_count"] = jevloop.ChoiceAnswer{Choice: "5", Confidence: 0.99}
	return result, err
}

func TestExplicitFiveTreesSurviveVariations(t *testing.T) {
	composer := Composer{Evaluator: fiveTreeEvaluator{t}}
	for _, seed := range []uint32{1, 42, 789} {
		spec, err := composer.ComposeVariant(context.Background(), "a village with five trees", seed)
		if err != nil {
			t.Fatal(err)
		}
		if len(spec.Objects) != 1 || spec.Objects[0].Type != "tree" || spec.Objects[0].Count != 5 {
			t.Fatalf("variation lost explicit tree count: %+v", spec.Objects)
		}
	}
}

func TestComposeBuildsFiniteSceneSpec(t *testing.T) {
	spec, err := (Composer{Evaluator: fakeEvaluator{}}).ComposeVariant(context.Background(), "two tents at sunset", 42)
	if err != nil {
		t.Fatal(err)
	}
	if spec.Variant != 42 || spec.Environment != "forest" || spec.Lighting != "sunset" || len(spec.Objects) != 1 {
		t.Fatalf("unexpected spec: %#v", spec)
	}
	if spec.Objects[0].Type != "tent" || spec.Objects[0].Count != 2 || spec.InputTokens != 42*spec.ModelCalls {
		t.Fatalf("unexpected object: %#v", spec.Objects[0])
	}
}

type skyEvaluator struct{ lighting, moonRequest, phase string }

func (e skyEvaluator) EvaluateChoices(ctx context.Context, state any, questions map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, error) {
	result, err := (fakeEvaluator{}).EvaluateChoices(ctx, state, questions)
	result.Answers["lighting"] = jevloop.ChoiceAnswer{Choice: e.lighting, Confidence: 1}
	result.Answers["moon_request"] = jevloop.ChoiceAnswer{Choice: e.moonRequest, Confidence: 1}
	result.Answers["moon"] = jevloop.ChoiceAnswer{Choice: e.phase, Confidence: 1}
	return result, err
}

func TestMoonConstraintsOverrideContradictoryModelChoices(t *testing.T) {
	for _, tc := range []struct{ name, lighting, request, phase, want string }{
		{"daytime festival", "day", "unspecified", "full", "none"},
		{"overcast daytime festival", "overcast", "unspecified", "full", "none"},
		{"nighttime festival", "night", "unspecified", "full", "full"},
		{"moon explicitly excluded", "night", "excluded", "full", "none"},
		{"explicit daytime moon", "day", "explicit", "full", "full"},
		{"explicit daytime crescent", "day", "explicit", "crescent", "crescent"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			composer := Composer{Evaluator: skyEvaluator{tc.lighting, tc.request, tc.phase}}
			spec, err := composer.ComposeVariant(context.Background(), tc.name, 42)
			if err != nil {
				t.Fatal(err)
			}
			if spec.Moon != tc.want {
				t.Fatalf("moon = %s, want %s", spec.Moon, tc.want)
			}
		})
	}
}

type emptySceneEvaluator struct{}

func (emptySceneEvaluator) EvaluateChoices(ctx context.Context, state any, questions map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, error) {
	result, err := (fakeEvaluator{}).EvaluateChoices(ctx, state, questions)
	result.Answers["scene_mode"] = jevloop.ChoiceAnswer{Choice: "empty", Confidence: 1}
	result.Answers["tent_count"] = jevloop.ChoiceAnswer{Choice: "0", Confidence: 1}
	return result, err
}

func TestEmptySceneEncodesObjectsAsArray(t *testing.T) {
	spec, err := (Composer{Evaluator: emptySceneEvaluator{}}).ComposeVariant(context.Background(), "empty meadow with no objects", 1)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"objects":[]`) {
		t.Fatalf("empty scene must remain iterable by the renderer: %s", data)
	}
}

func TestChoosePlausibleVariesWithoutSelectingWeakOutlier(t *testing.T) {
	input := jevloop.ChoiceAnswer{
		Choice: "central", Confidence: 0.5,
		Probabilities: map[string]float64{"central": 0.5, "circular": 0.4, "path": 0.1},
	}
	seen := map[string]bool{}
	for variant := uint32(1); variant <= 100; variant++ {
		answer := choosePlausible(input, variant, "composition")
		if answer.Choice == "path" {
			t.Fatal("selected an implausible low-probability outlier")
		}
		seen[answer.Choice] = true
	}
	if !seen["central"] || !seen["circular"] {
		t.Fatalf("expected plausible variation, saw %v", seen)
	}
}
