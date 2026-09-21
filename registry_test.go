package jevloop

import (
	"context"
	"testing"
)

func TestRegistryExecutesAllowListedTool(t *testing.T) {
	registry := NewRegistry()
	if err := registry.Register(Tool{
		Name: "move", Description: "Move once.",
		Handler: func(_ context.Context, args map[string]any) (any, error) {
			return args["direction"], nil
		},
	}); err != nil {
		t.Fatal(err)
	}
	result, err := registry.Execute(context.Background(), Action{
		Tool: "move", Arguments: map[string]any{"direction": "up"},
	})
	if err != nil || result != "up" {
		t.Fatalf("result=%v err=%v", result, err)
	}
}
