package jevloop

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// ToolDefinition matches the useful subset of an MCP tool definition. The
// input schema stays ordinary JSON Schema so transport adapters need no Jev
// specific metadata.
type ToolDefinition struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	InputSchema JSONSchema `json:"inputSchema"`
}

type JSONSchema struct {
	Type       string                `json:"type,omitempty"`
	Properties map[string]JSONSchema `json:"properties,omitempty"`
	Required   []string              `json:"required,omitempty"`
	Enum       []any                 `json:"enum,omitempty"`
	Default    any                   `json:"default,omitempty"`
}

// ExpandFiniteTool converts an MCP-style input schema into complete action
// candidates. Required open-ended values fail closed. Optional open-ended
// values are omitted so the tool can use its own default behavior.
func ExpandFiniteTool(tool ToolDefinition, maxActions int) ([]Action, error) {
	if tool.Name == "" || tool.Description == "" {
		return nil, fmt.Errorf("tool name and description are required")
	}
	if tool.InputSchema.Type != "" && tool.InputSchema.Type != "object" {
		return nil, fmt.Errorf("tool %q input schema must be an object", tool.Name)
	}
	if maxActions <= 0 {
		maxActions = 253
	}
	required := make(map[string]bool, len(tool.InputSchema.Required))
	for _, name := range tool.InputSchema.Required {
		required[name] = true
	}
	names := make([]string, 0, len(tool.InputSchema.Properties))
	for name := range tool.InputSchema.Properties {
		names = append(names, name)
	}
	sort.Strings(names)

	combinations := []map[string]any{{}}
	for _, name := range names {
		schema := tool.InputSchema.Properties[name]
		values, err := finiteValues(schema)
		if err != nil {
			if required[name] {
				return nil, fmt.Errorf("tool %q required argument %q: %w", tool.Name, name, err)
			}
			continue
		}
		if !required[name] {
			values = append([]any{omitted{}}, values...)
		}
		next := make([]map[string]any, 0, len(combinations)*len(values))
		for _, combination := range combinations {
			for _, value := range values {
				copy := cloneArguments(combination)
				if _, skip := value.(omitted); !skip {
					copy[name] = value
				}
				next = append(next, copy)
				if len(next) > maxActions {
					return nil, fmt.Errorf("tool %q expands beyond %d actions", tool.Name, maxActions)
				}
			}
		}
		combinations = next
	}

	actions := make([]Action, 0, len(combinations))
	for _, arguments := range combinations {
		encoded, err := json.Marshal(arguments)
		if err != nil {
			return nil, fmt.Errorf("encode tool %q arguments: %w", tool.Name, err)
		}
		sum := sha256.Sum256(encoded)
		id := tool.Name + ":" + hex.EncodeToString(sum[:6])
		description := tool.Description
		if len(arguments) > 0 {
			description += "; call with " + string(encoded)
		} else {
			description += "; call with no arguments"
		}
		actions = append(actions, Action{
			ID: id, Tool: tool.Name, Description: description, Arguments: arguments,
		})
	}
	return actions, nil
}

type omitted struct{}

func finiteValues(schema JSONSchema) ([]any, error) {
	if len(schema.Enum) > 0 {
		return append([]any(nil), schema.Enum...), nil
	}
	if schema.Type == "boolean" {
		return []any{false, true}, nil
	}
	if schema.Default != nil {
		return []any{schema.Default}, nil
	}
	kind := schema.Type
	if kind == "" {
		kind = "value"
	}
	return nil, fmt.Errorf("%s has no finite enum, boolean domain, or default", kind)
}

func cloneArguments(arguments map[string]any) map[string]any {
	copy := make(map[string]any, len(arguments)+1)
	for key, value := range arguments {
		copy[key] = value
	}
	return copy
}

// DescribeUnsupportedArguments returns a stable list useful to an application
// that wants to attach its own candidate provider for open-ended arguments.
func DescribeUnsupportedArguments(tool ToolDefinition) []string {
	required := make(map[string]bool, len(tool.InputSchema.Required))
	for _, name := range tool.InputSchema.Required {
		required[name] = true
	}
	var result []string
	for name, schema := range tool.InputSchema.Properties {
		if _, err := finiteValues(schema); err != nil {
			qualifier := "optional"
			if required[name] {
				qualifier = "required"
			}
			result = append(result, strings.Join([]string{name, qualifier, schema.Type}, ":"))
		}
	}
	sort.Strings(result)
	return result
}
