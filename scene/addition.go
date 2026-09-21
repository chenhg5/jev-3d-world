package scene

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"math"
	"strconv"

	"github.com/chenhg5/jev-3d-world"
)

func ValidateCurrent(current *Spec) error {
	if current == nil {
		return fmt.Errorf("current scene is required for additions")
	}
	known := map[string]bool{}
	for _, asset := range assets {
		known[asset.name] = true
	}
	total := 0
	for _, item := range current.Objects {
		if !known[item.Type] || item.Count < 1 || item.Count > 400 {
			return fmt.Errorf("invalid current scene inventory")
		}
		total += item.Count
	}
	if total >= 400 {
		return fmt.Errorf("scene limit reached: start a new scene (400 objects maximum)")
	}
	return nil
}

// ComposeAddition returns a delta: existing objects are context, never output.
// Environment and manual transforms remain owned by the client.
func (c Composer) ComposeAddition(ctx context.Context, request string, current Spec) (Spec, error) {
	if err := ValidateCurrent(&current); err != nil {
		return Spec{}, err
	}
	if c.Evaluator == nil {
		return Spec{}, fmt.Errorf("choice evaluator is required")
	}
	var seed [4]byte
	if _, err := rand.Read(seed[:]); err != nil {
		return Spec{}, err
	}
	state := map[string]any{
		"request":          request,
		"existing_objects": current.Objects,
		"environment":      current.Environment,
		"rule":             "Append only. Existing objects are already present and must not be recreated. Only select NEW additions from request. Objects mentioned solely as location references are not additions. Preserve existing environment, time of day and objects. Modification, deletion or time-of-day requests alone add nothing.",
	}
	questions := map[string]jevloop.ChoiceQuestion{}
	for _, asset := range assets {
		questions[asset.name+"_count"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf("How many NEW %s objects does `request` ask to ADD to `existing_objects`? %s. Choose 0 if absent, excluded, only a location reference, or only being modified. Never repeat existing objects just because they appear in context. 'Add two' means 2 additional objects; 'make the total five' means max(0,5-existing count). A concrete requested quantity is exact, capped at 20. Unnumbered plural means 2 or 3. A broad requested addition may infer a few defining props, not an entire replacement scene.", asset.name, asset.description),
			Criteria:     asset.counts,
		}
	}
	result, calls, err := c.evaluateBatches(ctx, state, questions)
	if err != nil {
		return Spec{}, err
	}
	delta := Spec{Variant: binary.LittleEndian.Uint32(seed[:]), Objects: []ObjectSpec{}, Model: result.Model,
		ModelCalls: calls, InputTokens: result.Usage.InputTokens, OutputTokens: result.Usage.OutputTokens, Confidence: 1}
	anchors := map[string]string{"none": "No specific existing object is a location reference; choose a free place."}
	total := 0
	for _, item := range current.Objects {
		anchors[item.Type] = "Existing " + item.Type + " as the location reference, not a new addition."
		total += item.Count
	}
	spatial := map[string]jevloop.ChoiceQuestion{}
	directions := map[string]string{"auto": "Near the reference if there is one; otherwise a suitable free place.", "left": "To the left (negative X).", "right": "To the right (positive X).", "foreground": "In front (positive Z).", "background": "Behind (negative Z).", "around": "Around the reference.", "center": "At the center."}
	for _, asset := range assets {
		answer, ok := result.Answers[asset.name+"_count"]
		count, parseErr := strconv.Atoi(answer.Choice)
		if !ok || parseErr != nil || count < 0 || count > 20 {
			return Spec{}, fmt.Errorf("invalid addition count for %s", asset.name)
		}
		delta.Confidence = math.Min(delta.Confidence, answer.Confidence)
		if count == 0 {
			continue
		}
		delta.Objects = append(delta.Objects, ObjectSpec{Type: asset.name, Count: count, Confidence: answer.Confidence})
		spatial[asset.name+"_anchor"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf("For NEW %s objects requested by `request`, which existing type in `existing_objects` is the spatial reference? E.g. 'two trees beside the pond' -> pond. No explicit reference -> none. Do not select a reference just because it exists.", asset.name), Criteria: anchors}
		spatial[asset.name+"_placement"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf("Which spatial direction does `request` specify for the NEW %s objects, relative to the named reference or scene center? Default auto. Interpret beside/旁边 as auto, behind/后面 as background, in front/前面 as foreground.", asset.name), Criteria: directions}
		spatial[asset.name+"_requested"] = jevloop.ChoiceQuestion{
			Instructions: fmt.Sprintf("Verify this proposed NEW addition against `request` ONLY: %s (%s). Does the user actually ask to ADD this kind of object? A location reference, an existing object, or an instruction to move/resize/rotate it is NOT an addition. Do not infer people/children/animals from trees, furniture or camping. The proposal can be wrong; reject unrelated props.", asset.name, asset.description),
			Criteria:     map[string]string{"add": "The request positively asks to add this object type (or a clear synonym/category that covers it).", "skip": "Not requested as a NEW addition, only mentioned as a location reference, negated, or merely being modified."},
		}
	}
	if len(spatial) == 0 {
		return delta, nil
	}
	positions, calls, err := c.evaluateBatches(ctx, state, spatial)
	if err != nil {
		return Spec{}, err
	}
	delta.ModelCalls += calls
	delta.InputTokens += positions.Usage.InputTokens
	delta.OutputTokens += positions.Usage.OutputTokens
	kept := make([]ObjectSpec, 0, len(delta.Objects))
	for i := range delta.Objects {
		item := &delta.Objects[i]
		verified := positions.Answers[item.Type+"_requested"].Choice
		if verified == "skip" {
			continue
		}
		if verified != "add" {
			return Spec{}, fmt.Errorf("invalid addition verification")
		}
		total += item.Count
		if total > 400 {
			return Spec{}, fmt.Errorf("addition would exceed the 400 object limit")
		}
		anchor := positions.Answers[item.Type+"_anchor"].Choice
		placement := positions.Answers[item.Type+"_placement"].Choice
		if _, ok := anchors[anchor]; !ok {
			return Spec{}, fmt.Errorf("invalid addition anchor")
		}
		if _, ok := directions[placement]; !ok {
			return Spec{}, fmt.Errorf("invalid addition placement")
		}
		item.Anchor = anchor
		item.Placement = placement
		kept = append(kept, *item)
	}
	delta.Objects = kept
	return delta, nil
}
