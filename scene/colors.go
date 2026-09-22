package scene

import (
	"context"
	"fmt"
	"math"
	"strconv"

	jevloop "github.com/chenhg5/jev-3d-world"
)

var objectColors = []struct {
	name, description string
}{
	{"red", "red / 红色"}, {"blue", "blue / 蓝色"}, {"green", "green / 绿色"},
	{"yellow", "yellow / 黄色"}, {"orange", "orange / 橙色"}, {"purple", "purple / 紫色"},
	{"pink", "pink / 粉色"}, {"white", "white / 白色"}, {"black", "black / 黑色"},
	{"gray", "gray or silver / 灰色或银色"}, {"brown", "brown / 棕色"}, {"cyan", "cyan / 青色"},
}

func knownObjectColor(name string) bool {
	if name == "auto" {
		return true
	}
	for _, color := range objectColors {
		if color.name == name {
			return true
		}
	}
	return false
}

func (c Composer) applyObjectColors(ctx context.Context, state any, objects []ObjectSpec) ([]ObjectSpec, int, jevloop.Usage, float64, error) {
	questions := map[string]jevloop.ChoiceQuestion{}
	for _, object := range objects {
		criteriaValues := make([]int, object.Count+1)
		for i := range criteriaValues {
			criteriaValues[i] = i
		}
		for _, color := range objectColors {
			questions[object.Type+"_"+color.name+"_color_count"] = jevloop.ChoiceQuestion{
				Instructions: fmt.Sprintf("Of the %d requested %s objects, how many are explicitly %s in `request`? Count only a color grammatically attached to this object type. Do not infer from mood, lighting or palette. The color counts across this type must not exceed %d.", object.Count, object.Type, color.description, object.Count),
				Criteria:     counts(criteriaValues...),
			}
		}
	}
	if len(questions) == 0 {
		return objects, 0, jevloop.Usage{}, 1, nil
	}
	result, calls, err := c.evaluateBatches(ctx, state, questions)
	if err != nil {
		return nil, calls, result.Usage, 0, err
	}
	colored := append([]ObjectSpec(nil), objects...)
	confidence := 1.0
	for index := range colored {
		object := &colored[index]
		object.Colors = make([]string, 0, object.Count)
		for _, color := range objectColors {
			answer, ok := result.Answers[object.Type+"_"+color.name+"_color_count"]
			count, parseErr := strconv.Atoi(answer.Choice)
			if !ok || parseErr != nil || count < 0 || count > object.Count {
				return nil, calls, result.Usage, 0, fmt.Errorf("invalid %s color count for %s", color.name, object.Type)
			}
			confidence = math.Min(confidence, answer.Confidence)
			for range count {
				if len(object.Colors) < object.Count {
					object.Colors = append(object.Colors, color.name)
				}
			}
		}
		for len(object.Colors) < object.Count {
			object.Colors = append(object.Colors, "auto")
		}
	}
	return colored, calls, result.Usage, confidence, nil
}
