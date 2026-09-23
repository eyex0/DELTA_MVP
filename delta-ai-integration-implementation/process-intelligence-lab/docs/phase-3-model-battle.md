# Phase 3 — Model benchmarking

The model battle runs the same benchmark cases, schema version, prompt version,
validation rules, and evaluation metrics for every configured profile.

```powershell
npm test
node dist/cli/index.js battle fixtures/benchmark-v2.json --split validation --out fixtures/model-battle-validation
```

The command writes:

- JSON experiment manifest with model metadata, exact generation settings,
  per-case raw output, parsed graph, validation result, metrics, latency, cost,
  and error taxonomy.
- Markdown multidimensional comparison report.

Only the validation split is accepted by the battle command. Test and challenge
sets are intentionally blocked to prevent optimization leakage.

Profiles without credentials or an adapter are recorded as `unavailable`; they
are not assigned quality metrics or treated as model failures. Cost is reported
only when token usage and configured rates exist.
