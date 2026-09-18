# AI evaluation harness

The fixture set contains 15 deterministic proposal and pitch-deck briefs that
cover ordinary, complex, healthcare, vague, pricing, traction, enterprise,
and adversarial inputs. The evaluator checks:

- non-empty output and the existing structured-output contract;
- required keywords and headings from the brief;
- unresolved placeholder text;
- bounded output size; and
- score regressions between a baseline prompt run and a candidate run.

Run the local harness with:

```bash
pnpm eval:ai
```

The harness does not call a provider. To evaluate a new prompt/model capture,
adapt the fixture `sampleOutput` values or add a candidate-output test and use
`compareEvaluationRuns` to fail on any fixture regression. Provider-backed
generation remains a separate, explicitly authorized integration check.
