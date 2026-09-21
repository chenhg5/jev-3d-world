package jevloop

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJevClientMapsClosedActionChoice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Fatal("missing authorization")
		}
		var request jevRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if request.Model != "jev-latest" || request.Questions["next_action"].Criteria["move_up"] == "" {
			t.Fatalf("unexpected request: %#v", request)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"model": "jev-1.13.0",
			"answers": map[string]any{"next_action": map[string]any{
				"type": "choice", "choice": "move_up", "confidence": 0.86,
				"probabilities": map[string]float64{"move_up": 0.93, "move_down": 0.07},
			}},
			"usage": map[string]int{"input_tokens": 123, "output_tokens": 12},
		})
	}))
	defer server.Close()

	decision, err := (JevClient{APIKey: "secret", Endpoint: server.URL}).Choose(context.Background(), DecisionInput{
		Goal: "go north",
		Actions: []Action{
			{ID: "move_up", Tool: "move", Description: "Move north."},
			{ID: "move_down", Tool: "move", Description: "Move south."},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if decision.ActionID != "move_up" || decision.Confidence != 0.86 || decision.Usage.InputTokens != 123 {
		t.Fatalf("unexpected decision: %#v", decision)
	}
}

func TestJevClientRejectsChoiceOutsideCandidates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"model":"jev","answers":{"next_action":{"type":"choice","choice":"invented","confidence":1}},"usage":{}}`))
	}))
	defer server.Close()
	_, err := (JevClient{APIKey: "secret", Endpoint: server.URL}).Choose(context.Background(), DecisionInput{
		Goal: "test", Actions: []Action{{ID: "known", Tool: "known", Description: "Known action."}},
	})
	if err == nil {
		t.Fatal("expected out-of-candidates error")
	}
}
