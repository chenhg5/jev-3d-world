package scene

import (
	"context"
	"fmt"
	"github.com/chenhg5/jev-3d-world"
	"sync"
	"testing"
)

type checkedEvaluator struct {
	mu      sync.Mutex
	seen    map[string]int
	largest int
}

func (e *checkedEvaluator) EvaluateChoices(_ context.Context, _ any, q map[string]jevloop.ChoiceQuestion) (jevloop.ChoiceResult, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if len(q) > e.largest {
		e.largest = len(q)
	}
	answers := map[string]jevloop.ChoiceAnswer{}
	for key := range q {
		e.seen[key]++
		answers[key] = jevloop.ChoiceAnswer{Choice: "yes", Confidence: 1}
	}
	return jevloop.ChoiceResult{Model: "test", Answers: answers, Usage: jevloop.Usage{InputTokens: len(q) * 2}}, nil
}

func TestBatchesCoverEveryQuestionExactlyOnceAndSumUsage(t *testing.T) {
	evaluator := &checkedEvaluator{seen: map[string]int{}}
	questions := map[string]jevloop.ChoiceQuestion{}
	for i := 0; i < 231; i++ {
		questions[fmt.Sprint(i)] = jevloop.ChoiceQuestion{Instructions: "Choose", Criteria: map[string]string{"yes": "yes", "no": "no"}}
	}
	result, calls, err := (Composer{Evaluator: evaluator}).evaluateBatches(context.Background(), "scene", questions)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 6 || evaluator.largest > 40 || len(result.Answers) != 231 || result.Usage.InputTokens != 462 {
		t.Fatalf("incorrect batching: calls=%d max=%d answers=%d usage=%+v", calls, evaluator.largest, len(result.Answers), result.Usage)
	}
	for key := range questions {
		if evaluator.seen[key] != 1 {
			t.Fatalf("%s evaluated %d times", key, evaluator.seen[key])
		}
	}
}
