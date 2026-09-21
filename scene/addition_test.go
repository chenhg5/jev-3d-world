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
