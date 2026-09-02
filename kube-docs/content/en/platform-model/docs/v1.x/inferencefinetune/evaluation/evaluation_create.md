---
title: "Create Model Evaluation Task"
keywords: "Industry AI Model Platform, model evaluation, OpenCompass, EvalScope, lm-evaluation-harness"
description: "How to create model evaluation tasks on the Industry AI Model Platform using standard benchmark tests to assess model performance."
linkTitle: "Create Model Evaluation Task"
weight: 6400
---

## Access Entry

On the model details page, click the **Model Evaluation** button to navigate to the evaluation task creation page.

{{< notice note >}}
Only some models support creating evaluation tasks. If the desired model does not have a "Model Evaluation" option, contact the platform administrator.
{{</ notice >}}

## Configuration Parameters

On the model evaluation task creation page, fill in the following configuration, then click **Create Evaluation**:

| Parameter | Description |
|-----------|-------------|
| **Task Name** | Custom evaluation task name |
| **Models** | Platform model IDs; compare up to 3 models in one task |
| **Description** | Optional note for this evaluation |
| **Datasets** | **System recommended**: benchmarks available in the selected framework image; **Custom**: existing repositories on the platform. See [Custom Evaluation Datasets](./evaluation_with_custom_dataset) for formats |
| **Region / Resource** | Cluster and compute specification |
| **Evaluation Framework** | Choose the framework (OpenCompass, EvalScope, or lm-evaluation-harness), then the framework version |
| **Framework args / vLLM args** | Shown when the selected version declares engine_args. These change runtime behavior, not the scoring formula |
| **Advanced options** | Collapsed. Prompt template and scoring plugins default from the selected dataset and framework. Overrides are not leaderboard-comparable |

For parameter boundaries, when to change them, and the report snapshot, see [Evaluation Custom Parameters](./evaluation_custom_params). For Prompt and plugin details, see [Scoring Plugins and Prompt Templates](./evaluation_scoring_plugins) and [Metrics Configuration](./evaluation_metrics_config).

## View Evaluation Results

After creation, use the top navigation to open **Model Training & Evaluation → Model Evaluation** to view the running status and results of all evaluation tasks. You can also view them centrally in **Resource Management**.

## Related Documentation

- [Evaluation Framework Overview](./evaluation_framework_intro)
- [Evaluation Custom Parameters](./evaluation_custom_params)
- [Custom Evaluation Datasets](./evaluation_with_custom_dataset)
- [Scoring Plugins and Prompt Templates](./evaluation_scoring_plugins)
- [Metrics Configuration](./evaluation_metrics_config)
- [FAQ](./evaluation_faq)
