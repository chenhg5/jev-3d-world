package jevloop

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
)

type StopReason string

const (
	StopCompleted     StopReason = "completed"
	StopModelFinished StopReason = "model_finished"
	StopBlocked       StopReason = "blocked"
	StopLowConfidence StopReason = "low_confidence"
	StopRepeated      StopReason = "repeated_state_action"
	StopStepLimit     StopReason = "step_limit"
)

type Runner struct {
	Decider               Decider
	MaxSteps              int
	MinConfidence         float64
	HistoryLimit          int
	MaxStateActionRepeats int
	OnStep                func(Step)
}

type Result struct {
	Reason StopReason `json:"reason"`
	Status string     `json:"status,omitempty"`
	Steps  []Step     `json:"steps"`
}

func (r Runner) Run(ctx context.Context, goal string, env Environment) (Result, error) {
	if r.Decider == nil {
		return Result{}, errors.New("decider is required")
	}
	if goal == "" {
		return Result{}, errors.New("goal is required")
	}
	maxSteps := r.MaxSteps
	if maxSteps <= 0 {
		maxSteps = 32
	}
	historyLimit := r.HistoryLimit
	if historyLimit <= 0 {
		historyLimit = 8
	}
	maxRepeats := r.MaxStateActionRepeats
	if maxRepeats <= 0 {
		maxRepeats = 2
	}

	result := Result{Steps: make([]Step, 0, maxSteps)}
	seen := make(map[string]int)
	for index := 0; index < maxSteps; index++ {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		snapshot, err := env.Observe(ctx)
		if err != nil {
			return result, fmt.Errorf("observe: %w", err)
		}
		if snapshot.Done {
			result.Reason, result.Status = StopCompleted, snapshot.Status
			return result, nil
		}
		actions, err := env.Actions(ctx, snapshot)
		if err != nil {
			return result, fmt.Errorf("list actions: %w", err)
		}
		actions, err = withControlActions(actions)
		if err != nil {
			return result, err
		}
		history := result.Steps
		if len(history) > historyLimit {
			history = history[len(history)-historyLimit:]
		}
		decision, err := r.Decider.Choose(ctx, DecisionInput{
			Goal: goal, State: snapshot.State, Actions: actions, History: history,
		})
		if err != nil {
			return result, fmt.Errorf("choose action: %w", err)
		}
		selected, ok := findAction(actions, decision.ActionID)
		if !ok {
			return result, fmt.Errorf("decider selected unavailable action %q", decision.ActionID)
		}
		stateJSON, err := json.Marshal(snapshot.State)
		if err != nil {
			return result, fmt.Errorf("encode state: %w", err)
		}
		step := Step{Index: index, State: stateJSON, Decision: decision, Action: selected}
		if decision.Confidence < r.MinConfidence {
			result.Reason = StopLowConfidence
			result.Steps = append(result.Steps, step)
			return result, nil
		}
		fingerprint := stateActionFingerprint(stateJSON, selected.ID)
		seen[fingerprint]++
		if seen[fingerprint] > maxRepeats {
			result.Reason = StopRepeated
			result.Steps = append(result.Steps, step)
			return result, nil
		}
		switch selected.ID {
		case ActionFinish:
			result.Reason = StopModelFinished
			result.Steps = append(result.Steps, step)
			return result, nil
		case ActionBlocked:
			result.Reason = StopBlocked
			result.Steps = append(result.Steps, step)
			return result, nil
		}
		step.Observation, err = env.Execute(ctx, selected)
		if err != nil {
			step.Observation = map[string]any{"error": err.Error()}
		}
		result.Steps = append(result.Steps, step)
		if r.OnStep != nil {
			r.OnStep(step)
		}
	}
	result.Reason = StopStepLimit
	return result, nil
}

func withControlActions(actions []Action) ([]Action, error) {
	if len(actions) > 253 {
		return nil, fmt.Errorf("too many legal actions: %d; Jev Choice supports 255 including control actions", len(actions))
	}
	seen := make(map[string]struct{}, len(actions)+2)
	result := append([]Action(nil), actions...)
	for _, action := range result {
		if action.ID == "" || action.Description == "" || action.Tool == "" {
			return nil, errors.New("every action requires id, description, and tool")
		}
		if action.ID == ActionFinish || action.ID == ActionBlocked {
			return nil, fmt.Errorf("action id %q is reserved", action.ID)
		}
		if _, ok := seen[action.ID]; ok {
			return nil, fmt.Errorf("duplicate action id %q", action.ID)
		}
		seen[action.ID] = struct{}{}
	}
	return append(result,
		Action{ID: ActionFinish, Tool: "control", Description: "The goal is already fully achieved; stop successfully without another tool call."},
		Action{ID: ActionBlocked, Tool: "control", Description: "None of the available actions can make progress toward the goal; stop as blocked."},
	), nil
}

func findAction(actions []Action, id string) (Action, bool) {
	for _, action := range actions {
		if action.ID == id {
			return action, true
		}
	}
	return Action{}, false
}

func stateActionFingerprint(state []byte, actionID string) string {
	sum := sha256.Sum256(append(append([]byte(nil), state...), actionID...))
	return hex.EncodeToString(sum[:])
}
