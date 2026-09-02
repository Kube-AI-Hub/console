---
title: "Using Model Evaluation"
keywords: "Industry AI Model Platform, model evaluation, evaluation status, evaluation results, view details, download results"
description: "How to use the model evaluation feature on the Industry AI Model Platform, including evaluation status descriptions, viewing details, downloading results, and deleting tasks."
linkTitle: "Using Model Evaluation"
weight: 6405
---

After an evaluation task is created, you can track its progress, view results, and manage tasks from the evaluation task list.

## Evaluation Status

Evaluation tasks go through the following statuses during execution:

| Status | Description |
|--------|-------------|
| **Evaluating** | The task is running. You can open details to inspect the configuration snapshot and status; scores and coverage are written after success |
| **Completed** | The evaluation has finished; results and detailed reports are viewable |
| **Failed** | The evaluation task failed; check the failure reason and logs |

{{< notice note >}}
Evaluation runtime depends on dataset size, number of benchmarks, and resource configuration. Large-scale evaluations may take a long time — please be patient.
{{</ notice >}}

## View Evaluation Details

Click **Details** in the task list while the task is running or after it finishes.

The details page contains the following information:

| Information | Description |
|-------------|-------------|
| **Overall Score** | Composite score across all evaluation benchmarks (written after success) |
| **Per-Benchmark Scores** | Individual scores for each benchmark/dataset |
| **Evaluation Metrics** | Specific metrics such as accuracy, F1 score, BLEU score, etc. |
| **Report** | Configuration snapshot (framework, Prompt, scoring plugins, engine_args), sample coverage, and failed examples. See [Evaluation Custom Parameters](./evaluation_custom_params) |

The evaluation details page gives you a comprehensive view of model performance across different benchmarks, providing data-driven insights for model selection and optimization.

## Download Evaluation Results

On the evaluation details page or in the task list, click the **Download** button to download the complete evaluation results file.

The downloaded file contains:

- Evaluation score summary table
- Detailed evaluation data for each benchmark
- Sample model prediction outputs

{{< notice tip >}}
Downloaded evaluation results can be used for offline analysis, team sharing, or archival records.
{{</ notice >}}

## Delete Evaluation Tasks

If an evaluation task is no longer needed, click the **Delete** button in the task list to remove it.

{{< notice warning >}}
Deletion is irreversible. Once an evaluation task is deleted, its results and associated data are permanently removed. Make sure you have downloaded any results you want to keep before deleting.
{{</ notice >}}
