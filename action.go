package jevloop

import (
	"context"
	"encoding/json"
)

const (
	ActionFinish  = "__finish"
	ActionBlocked = "__blocked"
)

// Action is one complete, executable tool call. Arguments must already be
// closed over finite values; Jev selects an action but does not invent values.
type Action struct {
	ID          string         `json:"id"`
	Description string         `json:"description"`
	Tool        string         `json:"tool"`
	Arguments   map[string]any `json:"arguments,omitempty"`
}

// Snapshot is the observable environment state at the beginning of a turn.
type Snapshot struct {
	State  any    `json:"state"`
	Done   bool   `json:"done"`
	Status string `json:"status,omitempty"`
}

// Environment exposes only the legal actions for the current state.
type Environment interface {
	Observe(context.Context) (Snapshot, error)
	Actions(context.Context, Snapshot) ([]Action, error)
	Execute(context.Context, Action) (any, error)
}

type DecisionInput struct {
	Goal    string   `json:"goal"`
	State   any      `json:"current_state"`
	Actions []Action `json:"legal_actions"`
	History []Step   `json:"recent_history,omitempty"`
}

type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type Decision struct {
	ActionID      string             `json:"action_id"`
	Confidence    float64            `json:"confidence"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
	Model         string             `json:"model,omitempty"`
	Usage         Usage              `json:"usage"`
}

type Decider interface {
	Choose(context.Context, DecisionInput) (Decision, error)
}

type Step struct {
	Index       int             `json:"index"`
	State       json.RawMessage `json:"state"`
	Decision    Decision        `json:"decision"`
	Action      Action          `json:"action"`
	Observation any             `json:"observation,omitempty"`
}
