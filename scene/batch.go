package scene

import (
	"context"
	"github.com/chenhg5/jev-3d-world"
	"sort"
	"sync"
)

// Bounded batches stay below Jev's token ceiling while retaining every asset.
func (c Composer) evaluateBatches(ctx context.Context, state any, questions map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, int, error) {
	const batchSize = 40
	keys := make([]string, 0, len(questions))
	for key := range questions {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	count := (len(keys) + batchSize - 1) / batchSize
	results := make([]jevloop.ChoiceResult, count)
	errors := make([]error, count)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	sem := make(chan struct{}, 3)
	var wait sync.WaitGroup
	for batch := 0; batch < count; batch++ {
		batch := batch
		start, end := batch*batchSize, min((batch+1)*batchSize, len(keys))
		subset := make(map[string]jevloop.ChoiceQuestion, end-start)
		for _, key := range keys[start:end] {
			subset[key] = questions[key]
		}
		wait.Add(1)
		go func() {
			defer wait.Done()
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				errors[batch] = ctx.Err()
				return
			}
			defer func() { <-sem }()
			result, err := c.Evaluator.EvaluateChoices(ctx, state, subset)
			if err != nil {
				errors[batch] = err
				cancel()
				return
			}
			filtered := make(map[string]jevloop.ChoiceAnswer, len(subset))
			for key := range subset {
				if value, ok := result.Answers[key]; ok {
					filtered[key] = value
				}
			}
			result.Answers = filtered
			results[batch] = result
		}()
	}
	wait.Wait()
	combined := jevloop.ChoiceResult{Answers: map[string]jevloop.ChoiceAnswer{}}
	for batch, result := range results {
		if errors[batch] != nil {
			return combined, count, errors[batch]
		}
		combined.Model = result.Model
		combined.Usage.InputTokens += result.Usage.InputTokens
		combined.Usage.OutputTokens += result.Usage.OutputTokens
		for key, value := range result.Answers {
			combined.Answers[key] = value
		}
	}
	return combined, count, nil
}
