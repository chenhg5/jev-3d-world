package scene

import (
	_ "embed"
	"encoding/json"
)

//go:embed catalog.json
var catalogData []byte

type AssetDefinition struct {
	Type        string  `json:"type"`
	Label       string  `json:"label"`
	Group       string  `json:"group"`
	Height      float64 `json:"height"`
	Description string  `json:"description"`
}

type asset struct {
	name        string
	description string
	counts      map[string]string
}

var definitions []AssetDefinition
var assets []asset

func init() {
	if err := json.Unmarshal(catalogData, &definitions); err != nil {
		panic(err)
	}
	seen := map[string]bool{}
	for _, definition := range definitions {
		if seen[definition.Type] || definition.Height <= 0 {
			panic("invalid asset catalog")
		}
		seen[definition.Type] = true
		assets = append(assets, asset{definition.Type, definition.Description, countOptions()})
	}
}

func Catalog() []AssetDefinition { return append([]AssetDefinition(nil), definitions...) }

func countOptions() map[string]string {
	values := make([]int, 21)
	for i := range values {
		values[i] = i
	}
	return counts(values...)
}
