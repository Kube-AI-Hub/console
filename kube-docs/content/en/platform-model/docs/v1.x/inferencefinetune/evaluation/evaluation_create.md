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
| **Model ID** | The model identifier on the platform |
| **Evaluation Framework** | Select the framework: OpenCompass, EvalScope, or lm-evaluation-harness |
| **Dataset Selection** | Select one or more benchmark datasets from the dataset list |
| **Resource Type** | **Shared Resources**: uses public compute, requires queuing; **Dedicated Resources**: exclusive compute, billed by time |

## View Evaluation Results

After creation, go to **Resource Console → Evaluation Task List** to view the running status and results of all evaluation tasks.

## Related Documentation

- [Evaluation Framework Overview](./evaluation_framework_intro)
- [Custom Evaluation Datasets](./evaluation_with_custom_dataset)
- [FAQ](./evaluation_faq)
