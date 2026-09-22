package scene

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/chenhg5/jev-3d-world"
)

type additionEvaluator struct{ empty, invalid bool }

func (f additionEvaluator) EvaluateChoices(_ context.Context, state any, questions map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, error) {
	s := state.(map[string]any)
	if len(s["existing_objects"].([]ObjectSpec)) != 2 {
		return jevloop.ChoiceResult{}, fmt.Errorf("existing inventory missing")
	}
	answers := map[string]jevloop.ChoiceAnswer{}
	for key, q := range questions {
		choice := "0"
		if key == "object_colors" {
			choice = "none"
		}
		if !f.empty && key == "cherry_count" {
			choice = "2"
		}
		if !f.empty && key == "child_count" {
			choice = "3"
		}
		if strings.HasSuffix(key, "_requested") {
			choice = "add"
		}
		if key == "child_requested" {
			choice = "skip"
		}
		if strings.HasSuffix(key, "_anchor") {
			choice = "pond"
			if _, ok := q.Criteria[choice]; !ok {
				return jevloop.ChoiceResult{}, fmt.Errorf("existing pond missing as anchor")
			}
		}
		if strings.HasSuffix(key, "_placement") {
			choice = "right"
		}
		if f.invalid {
			choice = "invalid"
		}
		answers[key] = jevloop.ChoiceAnswer{Choice: choice, Confidence: .95}
	}
	return jevloop.ChoiceResult{Model: "test", Answers: answers, Usage: jevloop.Usage{InputTokens: 10}}, nil
}

type largeWorldAdditionEvaluator struct{}

func (largeWorldAdditionEvaluator) EvaluateChoices(_ context.Context, _ any, questions map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, error) {
	answers := map[string]jevloop.ChoiceAnswer{}
	for key, question := range questions {
		if len(question.Criteria) < 2 {
			return jevloop.ChoiceResult{}, fmt.Errorf("question %q has fewer than two criteria", key)
		}
		choice := "0"
		if key == "object_colors" {
			choice = "none"
		}
		switch key {
		case "boat_count":
			choice = "3"
		case "person_count":
			choice = "3"
		case "boat_anchor", "person_anchor":
			if _, ok := question.Criteria["scene"]; !ok {
				return jevloop.ChoiceResult{}, fmt.Errorf("large world scene anchor missing")
			}
			choice = "scene"
		case "boat_placement", "person_placement":
			choice = "auto"
		case "boat_requested", "person_requested":
			choice = "add"
		default:
			if strings.HasSuffix(key, "_requested") {
				choice = "skip"
			} else if strings.HasSuffix(key, "_anchor") {
				choice = "none"
			} else if strings.HasSuffix(key, "_placement") {
				choice = "auto"
			}
		}
		answers[key] = jevloop.ChoiceAnswer{Choice: choice, Confidence: .95}
	}
	return jevloop.ChoiceResult{Model: "test", Answers: answers}, nil
}
func TestAdditionReturnsOnlyDeltaAndExistingAnchor(t *testing.T) {
	current := Spec{Environment: "meadow", Objects: []ObjectSpec{{Type: "pond", Count: 1}, {Type: "tent", Count: 3}}}
	delta, err := (Composer{Evaluator: additionEvaluator{}}).ComposeAddition(context.Background(), "在池塘右边加两棵樱花树", current)
	if err != nil {
		t.Fatal(err)
	}
	if len(delta.Objects) != 1 || delta.Objects[0].Type != "cherry" || delta.Objects[0].Count != 2 || delta.Objects[0].Anchor != "pond" || delta.Objects[0].Placement != "right" {
		t.Fatalf("incorrect delta: %+v", delta)
	}
	if len(current.Objects) != 2 || current.Objects[1].Count != 3 {
		t.Fatal("mutated existing inventory")
	}
	if delta.ModelCalls != 4 {
		t.Fatalf("expected 3 count batches + 1 spatial batch, got %d", delta.ModelCalls)
	}
	for _, f := range []additionEvaluator{{empty: true}, {invalid: true}} {
		delta, err = (Composer{Evaluator: f}).ComposeAddition(context.Background(), "do not add anything", current)
		if f.invalid && err == nil {
			t.Fatal("accepted invalid model answer")
		}
		if f.empty && (err != nil || len(delta.Objects) != 0 || delta.ModelCalls != 3) {
			t.Fatal("empty delta should skip spatial inference")
		}
	}
}
func TestValidateAdditionInventory(t *testing.T) {
	for _, current := range []*Spec{nil, {Objects: []ObjectSpec{{Type: "nonexistent", Count: 1}}}, {Objects: []ObjectSpec{{Type: "tree", Count: -1}}}, {Objects: []ObjectSpec{{Type: "tree", Count: 400}}}} {
		if ValidateCurrent(current) == nil {
			t.Fatal("accepted invalid or full inventory")
		}
	}
	if err := ValidateCurrent(&Spec{Objects: []ObjectSpec{{Type: "tree", Count: 50}}}); err != nil {
		t.Fatal(err)
	}
}

func TestAdditionUsesLargeWorldAsSemanticAnchor(t *testing.T) {
	current := Spec{ScenePack: "ocean_liner", Environment: "ocean", Objects: []ObjectSpec{}}
	delta, err := (Composer{Evaluator: largeWorldAdditionEvaluator{}}).ComposeAddition(context.Background(), "加几艘小船在旁边，加一些人在大船上", current)
	if err != nil {
		t.Fatal(err)
	}
	if len(delta.Objects) != 2 {
		t.Fatalf("expected boats and people, got %+v", delta.Objects)
	}
	for _, object := range delta.Objects {
		if object.Anchor != "scene" || object.Count != 3 {
			t.Fatalf("large-world addition lost semantic anchor: %+v", object)
		}
	}
}
