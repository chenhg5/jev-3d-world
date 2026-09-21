package jevloop

import "testing"

func TestExpandFiniteTool(t *testing.T) {
	actions, err := ExpandFiniteTool(ToolDefinition{
		Name: "move", Description: "Move the player.",
		InputSchema: JSONSchema{
			Type: "object",
			Properties: map[string]JSONSchema{
				"direction": {Type: "string", Enum: []any{"up", "down"}},
				"sprint":    {Type: "boolean"},
				"note":      {Type: "string"},
			},
			Required: []string{"direction"},
		},
	}, 20)
	if err != nil {
		t.Fatal(err)
	}
	// direction has 2 values; optional sprint has omitted/false/true; optional
	// open note is safely omitted.
	if len(actions) != 6 {
		t.Fatalf("got %d actions, want 6", len(actions))
	}
	for _, action := range actions {
		if _, exists := action.Arguments["note"]; exists {
			t.Fatal("open optional argument should be omitted")
		}
	}
}

func TestExpandFiniteToolRejectsRequiredOpenArgument(t *testing.T) {
	_, err := ExpandFiniteTool(ToolDefinition{
		Name: "draw", Description: "Draw a node.",
		InputSchema: JSONSchema{
			Type:       "object",
			Properties: map[string]JSONSchema{"label": {Type: "string"}},
			Required:   []string{"label"},
		},
	}, 20)
	if err == nil {
		t.Fatal("expected required open argument to fail closed")
	}
}

func TestExpandFiniteToolBoundsCartesianProduct(t *testing.T) {
	_, err := ExpandFiniteTool(ToolDefinition{
		Name: "large", Description: "Too many combinations.",
		InputSchema: JSONSchema{
			Type: "object",
			Properties: map[string]JSONSchema{
				"a": {Type: "boolean"}, "b": {Type: "boolean"}, "c": {Type: "boolean"},
			},
			Required: []string{"a", "b", "c"},
		},
	}, 4)
	if err == nil {
		t.Fatal("expected expansion bound error")
	}
}
