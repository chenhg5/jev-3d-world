package jevloop

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const DefaultEndpoint = "https://api.typesafe.ai/v1/systemone"

type JevClient struct {
	APIKey   string
	Endpoint string
	Model    string
	HTTP     *http.Client
}

type ChoiceQuestion struct {
	Instructions string
	Criteria     map[string]string
}

type ChoiceAnswer struct {
	Choice        string             `json:"choice"`
	Confidence    float64            `json:"confidence"`
	Probabilities map[string]float64 `json:"probabilities,omitempty"`
}

type ChoiceResult struct {
	Model   string                  `json:"model"`
	Answers map[string]ChoiceAnswer `json:"answers"`
	Usage   Usage                   `json:"usage"`
}

type jevQuestion struct {
	Type         string            `json:"type"`
	Instructions string            `json:"instructions"`
	Criteria     map[string]string `json:"criteria"`
}

type jevRequest struct {
	Model     string                 `json:"model"`
	State     any                    `json:"state"`
	Questions map[string]jevQuestion `json:"questions"`
}

type jevResponse struct {
	Model   string `json:"model"`
	Answers map[string]struct {
		Type          string             `json:"type"`
		Choice        string             `json:"choice"`
		Confidence    float64            `json:"confidence"`
		Probabilities map[string]float64 `json:"probabilities"`
	} `json:"answers"`
	Usage Usage `json:"usage"`
}

type jevState struct {
	Goal          string       `json:"goal"`
	CurrentState  any          `json:"current_state"`
	RecentHistory []jevHistory `json:"recent_history,omitempty"`
}

type jevHistory struct {
	ActionID    string `json:"action_id"`
	Observation any    `json:"observation,omitempty"`
}

// EvaluateChoices evaluates independent closed-set questions over one shared
// state. Every returned choice is checked against the offered criteria.
func (c JevClient) EvaluateChoices(
	ctx context.Context,
	state any,
	questions map[string]ChoiceQuestion,
) (ChoiceResult, error) {
	if c.APIKey == "" {
		return ChoiceResult{}, errors.New("TypeSafe API key is required")
	}
	if len(questions) == 0 {
		return ChoiceResult{}, errors.New("at least one choice question is required")
	}
	encodedQuestions := make(map[string]jevQuestion, len(questions))
	for name, question := range questions {
		if name == "" || question.Instructions == "" || len(question.Criteria) < 2 {
			return ChoiceResult{}, fmt.Errorf("question %q requires instructions and at least two criteria", name)
		}
		if len(question.Criteria) > 255 {
			return ChoiceResult{}, fmt.Errorf("question %q exceeds 255 criteria", name)
		}
		encodedQuestions[name] = jevQuestion{
			Type: "choice", Instructions: question.Instructions, Criteria: question.Criteria,
		}
	}
	body, err := json.Marshal(jevRequest{
		Model: valueOr(c.Model, "jev-latest"), State: state, Questions: encodedQuestions,
	})
	if err != nil {
		return ChoiceResult{}, fmt.Errorf("encode Jev request: %w", err)
	}
	result, err := c.do(ctx, body)
	if err != nil {
		return ChoiceResult{}, err
	}
	answers := make(map[string]ChoiceAnswer, len(questions))
	for name, question := range questions {
		answer, ok := result.Answers[name]
		if !ok || answer.Type != "choice" || answer.Choice == "" {
			return ChoiceResult{}, fmt.Errorf("Jev response is missing %q choice", name)
		}
		if _, ok := question.Criteria[answer.Choice]; !ok {
			return ChoiceResult{}, fmt.Errorf(
				"Jev selected choice outside the offered criteria for %q: %q", name, answer.Choice,
			)
		}
		answers[name] = ChoiceAnswer{
			Choice: answer.Choice, Confidence: answer.Confidence,
			Probabilities: answer.Probabilities,
		}
	}
	return ChoiceResult{Model: result.Model, Answers: answers, Usage: result.Usage}, nil
}

func (c JevClient) Choose(ctx context.Context, input DecisionInput) (Decision, error) {
	criteria := make(map[string]string, len(input.Actions))
	for _, action := range input.Actions {
		detail := action.Description
		if len(action.Arguments) > 0 {
			encoded, err := json.Marshal(action.Arguments)
			if err != nil {
				return Decision{}, fmt.Errorf("encode arguments for %q: %w", action.ID, err)
			}
			detail += "; exact arguments: " + string(encoded)
		}
		criteria[action.ID] = detail
	}
	history := make([]jevHistory, 0, len(input.History))
	for _, step := range input.History {
		history = append(history, jevHistory{
			ActionID: step.Action.ID, Observation: step.Observation,
		})
	}
	result, err := c.EvaluateChoices(ctx, jevState{
		Goal: input.Goal, CurrentState: input.State, RecentHistory: history,
	}, map[string]ChoiceQuestion{"next_action": {
		Instructions: "Choose exactly one legal action that best advances `goal` from `current_state`. Use `recent_history` to avoid repeating failed or unproductive actions. Choose __finish only when the goal is already fully achieved. Choose __blocked only when no offered action can make progress.",
		Criteria:     criteria,
	}})
	if err != nil {
		return Decision{}, err
	}
	answer := result.Answers["next_action"]
	return Decision{
		ActionID: answer.Choice, Confidence: answer.Confidence,
		Probabilities: answer.Probabilities, Model: result.Model, Usage: result.Usage,
	}, nil
}

func (c JevClient) do(ctx context.Context, body []byte) (jevResponse, error) {
	endpoint := valueOr(c.Endpoint, DefaultEndpoint)
	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 12 * time.Second}
	}
	var lastStatus int
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			return jevResponse{}, err
		}
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
		req.Header.Set("Content-Type", "application/json")
		response, err := httpClient.Do(req)
		if err != nil {
			lastErr = err
			if ctx.Err() != nil {
				return jevResponse{}, fmt.Errorf("call Jev: %w", ctx.Err())
			}
			if attempt < 2 {
				if err := waitForRetry(ctx, attempt); err != nil {
					return jevResponse{}, fmt.Errorf("call Jev: %w", err)
				}
				continue
			}
			return jevResponse{}, fmt.Errorf("call Jev after 3 attempts: %w", lastErr)
		}
		responseBody, readErr := io.ReadAll(io.LimitReader(response.Body, 2<<20))
		response.Body.Close()
		if readErr != nil {
			return jevResponse{}, fmt.Errorf("read Jev response: %w", readErr)
		}
		lastStatus = response.StatusCode
		if response.StatusCode == http.StatusTooManyRequests || response.StatusCode == 529 {
			if attempt < 2 {
				if err := waitForRetry(ctx, attempt); err != nil {
					return jevResponse{}, err
				}
				continue
			}
			break
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			return jevResponse{}, fmt.Errorf(
				"Jev returned HTTP %d: %s", response.StatusCode, truncate(responseBody, 300),
			)
		}
		var result jevResponse
		if err := json.Unmarshal(responseBody, &result); err != nil {
			return jevResponse{}, fmt.Errorf("decode Jev response: %w", err)
		}
		return result, nil
	}
	return jevResponse{}, fmt.Errorf("Jev unavailable after retries (HTTP %d)", lastStatus)
}

func waitForRetry(ctx context.Context, attempt int) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(time.Duration(200*(1<<attempt)) * time.Millisecond):
		return nil
	}
}

func valueOr(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}

func truncate(value []byte, limit int) string {
	if len(value) <= limit {
		return string(value)
	}
	return string(value[:limit]) + "..."
}
