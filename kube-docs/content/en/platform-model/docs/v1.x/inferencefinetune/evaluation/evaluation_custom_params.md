---
title: "Evaluation Custom Parameters"
keywords: "Industry AI Model Platform, model evaluation, custom parameters, engine args, vLLM, prompt template, scoring plugin"
description: "Custom parameters on the create-evaluation page: framework args, vLLM args, and advanced Prompt templates and scoring plugins."
linkTitle: "Evaluation Custom Parameters"
weight: 6430
---

The main create-evaluation flow is unchanged: choose models, datasets, region resources, and the evaluation framework. After you pick a framework version, the page may offer three optional groups. Leave them unchanged to keep the framework and dataset defaults.

## Three Kinds of Parameters

| Where | Parameters | What changes |
|-------|------------|--------------|
| Collapsed **Framework args** | engine_args exposed by the selected evaluation framework (for example few-shot count or max generation length) | Changes how inference or the evaluator runs; **does not** change the scoring formula |
| Collapsed **vLLM args** | Shown when evaluation uses a vLLM backend (for example dtype or max generation length) | Affects the inference engine only, not the metric definition |
| Collapsed **Advanced options** | **Prompt template** and **scoring plugins** | A Prompt change is a protocol change and is not leaderboard-comparable; plugins select which native framework metrics to use |

Do not use Prompt to “switch metrics”, and do not use framework or vLLM args to “redefine accuracy”.

## Framework Args and vLLM Args

These sections appear only when the selected framework version declares engine_args. The fields come from the image configuration.

Typical uses:

- Control batch size, max generation length, or dtype to avoid OOM or truncation.
- Toggle runtime options without changing the question text or scoring.

Unchanged fields are omitted from the submit body, so the task uses framework defaults. Changed fields are stored in the evaluation report snapshot.

## Advanced Options: Prompt and Scoring Plugins

This block is collapsed by default. When opened, it fills defaults from the recommended catalog for the **selected framework and datasets**. Switching framework or dataset reloads those defaults.

| Situation | Recommendation |
|-----------|----------------|
| Official recommended sets, comparing Accuracy with a paper or leaderboard | **Do not** change the Prompt; keep the framework default metrics |
| Custom business sets, production system prompts, protocol ablations, or LLM Judge | Then change the Prompt or scoring plugins |

After an override, treat the score as a custom protocol for this task. The selected template and plugins are written into the report snapshot. Plugins must match the current framework; do not mix OpenCompass, lm-evaluation-harness, and EvalScope.

If a custom dataset is not in the recommended catalog, advanced options stay empty. That still means “the framework default for this file layout”. You can then pick a compatible template and plugins.

For when to change prompts, see [Scoring Plugins and Prompt Templates](./evaluation_scoring_plugins). For metric mapping, see [Metrics Configuration](./evaluation_metrics_config).

## What the Report Shows

The **Report** tab shows the configuration snapshot (model / dataset revision, framework, Prompt, plugins, engine_args), sample coverage, and failed examples. You can open details while the task is still running to inspect configuration and status; scores are written after success.

`report_id` is the same as the evaluation `task_id`. Later comparisons or publish gates should bind this id instead of changing a historical template and rescoring the same task.

## Related Documentation

- [Create Model Evaluation Task](./evaluation_create)
- [Scoring Plugins and Prompt Templates](./evaluation_scoring_plugins)
- [Metrics Configuration](./evaluation_metrics_config)
- [Using Model Evaluation](./evaluation_usage)
