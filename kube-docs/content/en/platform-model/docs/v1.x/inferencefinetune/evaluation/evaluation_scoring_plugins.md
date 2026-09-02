---
title: "Scoring Plugins and Prompt Templates"
keywords: "Industry AI Model Platform, model evaluation, scoring plugin, prompt template, advanced options"
description: "How advanced options load default prompt templates and scoring plugins from the selected framework and dataset, and when you should override them."
linkTitle: "Scoring Plugins and Prompt Templates"
weight: 6435
---

## Where advanced options live

The create-evaluation flow is unchanged: choose models, datasets, cluster resources, then the **evaluation framework** and version, plus existing framework / vLLM args. See [Evaluation Custom Parameters](./evaluation_custom_params) for how the three option groups differ.

**Prompt templates** and **scoring plugins** are in collapsed **Advanced options**. Leave them unchanged to keep today's behavior: the framework plus dataset native protocol.

When you expand advanced options, the page fills defaults for the **current framework and dataset**:

- `default_prompt_template_id`
- `default_scoring_plugin_ids`

These come from the system recommended catalog. Changing the framework or dataset reloads defaults and overwrites unsaved edits, so plugins from a previous framework are not left in the form.

Every scoring plugin has a `framework` (`opencompass` / `lm-evaluation-harness` / `evalscope`) and must match the selected evaluation framework. Cross-framework mixing is not allowed.

The advanced-options note states that overrides are not comparable with official leaderboards, and that the selected template and plugins are written into the evaluation report snapshot.

## Custom datasets have no catalog defaults

A custom dataset is not in the recommended catalog, so advanced options stay empty. That still means "the framework's default protocol for this file layout". You can optionally pick compatible templates and plugins.

## When to change the prompt

The evaluation prompt is part of the protocol, not a way to make the model look smarter. Do **not** change prompts on official recommended sets (MMLU, C-Eval, GSM8K, and similar): scores are comparable only with the same `doc_to_text` / few-shot / chat template as the paper or leaderboard. After a prompt change, treat the score as a custom protocol for this task.

**Change it (this is when advanced options matter)**

- **Custom business sets**: your csv/jsonl has no in-framework template, so you must define how the question is assembled.
- **Match production system prompts**: customer-service or policy assistants.
- **Base vs chat models**: completion template vs chat template.
- **Protocol ablations**: zero-shot vs a specific few-shot wording, Chinese vs English stems, or "let's think step by step".
- **Safety / refusal / red team**: a fixed attack prefix or policy wording.
- **LLM Judge**: the judge rubric is a separate prompt from the candidate model's answering prompt.

**Do not change it**

- Official recommended sets used to compare Accuracy or reproduce a paper: keep the framework default.
- You only want a different metric: use a scoring plugin, not the prompt.
- You only want a different batch size or max generation length: use engine_args.

OpenCompass **official sets** mostly bake prompts into in-image configs. P0 does not promise arbitrary prompts on every official OpenCompass set. For lm-evaluation-harness custom datasets, the selected template can overlay `doc_to_text` and scoring plugins can overlay `metric_list`.

## Related documentation

- [Evaluation Custom Parameters](./evaluation_custom_params)
- [Metrics configuration](./evaluation_metrics_config)
- [Create Model Evaluation Task](./evaluation_create)
- [Evaluation Framework Overview](./evaluation_framework_intro)
- [Custom Evaluation Datasets](./evaluation_with_custom_dataset)
