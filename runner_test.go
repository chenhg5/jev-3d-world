package jevloop

import (
	"context"
	"testing"
)

type sequenceDecider struct {
	ids []string
	pos int
}

func (d *sequenceDecider) Choose(_ context.Context, input DecisionInput) (Decision, error) {
	id := d.ids[d.pos]
	d.pos++
	return Decision{ActionID: id, Confidence: 0.9}, nil
}

type counterEnvironment struct{ value int }

func (e *counterEnvironment) Observe(context.Context) (Snapshot, error) {
	return Snapshot{State: map[string]int{"value": e.value}, Done: e.value == 2, Status: "two"}, nil
}
func (e *counterEnvironment) Actions(context.Context, Snapshot) ([]Action, error) {
	return []Action{{ID: "increment", Tool: "increment", Description: "Increment once."}}, nil
}
func (e *counterEnvironment) Execute(context.Context, Action) (any, error) {
	e.value++
	return e.value, nil
}

func TestRunnerCompletesFromObservedState(t *testing.T) {
	env := &counterEnvironment{}
	result, err := (Runner{
		Decider: &sequenceDecider{ids: []string{"increment", "increment"}}, MaxSteps: 5,
	}).Run(context.Background(), "reach two", env)
	if err != nil {
		t.Fatal(err)
	}
	if result.Reason != StopCompleted || len(result.Steps) != 2 || env.value != 2 {
		t.Fatalf("unexpected result: %#v value=%d", result, env.value)
	}
}

type fixedDecider struct{ decision Decision }

func (d fixedDecider) Choose(context.Context, DecisionInput) (Decision, error) {
	return d.decision, nil
}

func TestRunnerLowConfidence(t *testing.T) {
	env := &counterEnvironment{}
	result, err := (Runner{
		Decider: fixedDecider{Decision{ActionID: "increment", Confidence: 0.2}}, MinConfidence: 0.8,
	}).Run(context.Background(), "reach two", env)
	if err != nil {
		t.Fatal(err)
	}
	if result.Reason != StopLowConfidence || env.value != 0 {
		t.Fatalf("reason=%s value=%d", result.Reason, env.value)
	}
}

func TestRunnerRejectsUnknownDecision(t *testing.T) {
	_, err := (Runner{Decider: fixedDecider{Decision{ActionID: "delete_world", Confidence: 1}}}).Run(
		context.Background(), "reach two", &counterEnvironment{},
	)
	if err == nil {
		t.Fatal("expected unavailable action error")
	}
}
