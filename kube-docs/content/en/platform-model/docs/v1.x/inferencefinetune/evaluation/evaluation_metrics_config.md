---
title: "Metrics Configuration"
keywords: "Industry AI Model Platform, model evaluation, scoring plugin, Accuracy, native_metric"
description: "How scoring plugins map to native metrics in OpenCompass, lm-evaluation-harness, and EvalScope, and why Accuracy is not comparable across frameworks."
linkTitle: "Metrics Configuration"
weight: 6440
---

## How scoring plugins map

A scoring plugin is a platform-registered scorer. At runtime it **maps** to the selected framework's metric or evaluator. The control plane does not score models. Evaluation still runs in GPU/NPU pods in the `spaces` namespace.

The same logical metric (for example Accuracy) is registered once per framework. `native_metric` is that framework's registered name. **Accuracy with the same display name is not comparable across frameworks.**

| Plugin id | Framework | Kind | native_metric | Direction |
|-----------|-----------|------|---------------|-----------|
| `opencompass.accuracy` | OpenCompass | rule | `accuracy` | higher is better |
| `lm-evaluation-harness.acc` | lm-evaluation-harness | rule | `acc` | higher is better |
| `evalscope.acc` | EvalScope | rule | `acc` | higher is better |
| `*.exact_match` / `*.f1` | matching framework | rule | `exact_match` / `f1` | higher is better |
| `*.bleu` / `*.rouge` / `*.chrf` | matching framework | overlap | framework name | higher is better |
| `*.llm_judge` | matching framework | LLM judge | `llm_judge` | higher is better (**not objective truth**) |

Aggregation defaults to `mean`. The report `metrics[]` array includes the raw name, direction, and aggregation. **Missing metrics are not filled with 0.**

## Boundary with engine_args

- **engine_args / vLLM parameters**: batch size, max generation length, dtype, and other inference settings. They do not change the scoring formula.
- **Scoring plugins**: which native framework metric to use.
- **Prompt templates**: the item protocol. Scores are no longer leaderboard-comparable.

Do not use a prompt to "change the metric", and do not use engine_args to "redefine accuracy".

## Report and publish gates

The evaluation detail **Report** tab shows the configuration snapshot (model/dataset revision, framework, prompt, plugins, engine_args), sample coverage, and a failures download. You can open details while the task is still running to inspect configuration and status.

`report_id` is the same as the evaluation `task_id` and is the immutable report identity. Later publish gates should bind this id instead of changing a historical template and rescoring the same task.

LLM Judge scores are stored in the report `judge` object (judge model, rubric, parse success rate). They are not objective ground truth and must not be the sole publish gate.

## Related documentation

- [Scoring Plugins and Prompt Templates](./evaluation_scoring_plugins)
- [Create Model Evaluation Task](./evaluation_create)
- [Evaluation Framework Overview](./evaluation_framework_intro)
