package jevloop

import (
	"context"
	"fmt"
	"sync"
)

type Handler func(context.Context, map[string]any) (any, error)

type Tool struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Handler     Handler `json:"-"`
}

// Registry executes allow-listed local functions. MCP adapters can implement
// the same boundary by registering a handler that calls a remote MCP tool.
type Registry struct {
	mu    sync.RWMutex
	tools map[string]Tool
}

func NewRegistry() *Registry {
	return &Registry{tools: make(map[string]Tool)}
}

func (r *Registry) Register(tool Tool) error {
	if tool.Name == "" || tool.Description == "" || tool.Handler == nil {
		return fmt.Errorf("tool name, description, and handler are required")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tools[tool.Name]; exists {
		return fmt.Errorf("tool %q is already registered", tool.Name)
	}
	r.tools[tool.Name] = tool
	return nil
}

func (r *Registry) Execute(ctx context.Context, action Action) (any, error) {
	r.mu.RLock()
	tool, ok := r.tools[action.Tool]
	r.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("tool %q is not registered", action.Tool)
	}
	return tool.Handler(ctx, action.Arguments)
}
