# Model Battle Report

Experiment: **MODEL-BATTLE-20260919222036**
Dataset: **2.0.0**, split: **validation**, cases: **20**

| Model | Class | Status | nodePrecision | nodeRecall | relationshipAccuracy | decisionAccuracy | actorAssignmentAccuracy | exceptionRecall | loopAccuracy | parallelismAccuracy | graphValidity | completeness | hallucinationRate | overall | averageLatencyMs | totalCost |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DELTA deterministic baseline | local | measured | 0.2857 | 0.1667 | 0.375 | 1 | 0 | 0 | 0 | 0 | 0 | 0.2083 | 0.7143 | 0.1735 | 0.15 | 0 |
| Microsoft Foundry configured deployment | cloud_llm | unavailable | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Reasoning model endpoint | reasoning_model | unavailable | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Open-weight model endpoint | open_weight | unavailable | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Error breakdown

| Model | Error category | Count |
|---|---|---:|
| Microsoft Foundry configured deployment | provider_unavailable | 20 |
| Reasoning model endpoint | provider_unavailable | 20 |
| Open-weight model endpoint | provider_unavailable | 20 |

This report contains measured validation-split results only. Unavailable providers are not treated as failures of model quality.
