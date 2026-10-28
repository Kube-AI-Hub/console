---
title: "Agent Evaluation"
keywords: "Industry AI Model Platform, agent evaluation, claw-eval, Agent Workshop"
description: "Evaluate a published agent by choosing the agent, a dataset, and an evaluation framework, then score it with a judge model or with code."
linkTitle: "Agent Evaluation"
weight: 6450
---

Agent evaluation sits under **Model Training & Evaluation**, next to model evaluation. It evaluates an agent that is already published in the Agent Workshop. The job still runs as a platform evaluation task.

## Entry

Open **Train / Eval** in the top bar and choose **Agent Evaluation** beside **Model Evaluation**.

![Agent Evaluation sits beside Model Evaluation in the training menu](/images/docs/platform-model/evaluation/agent-menu.png)

The workshop agent card, and the digital-twin and service-expert builders, also have **Evaluate**. A published agent opens the create page with that agent selected. A draft must be published first.

![Evaluate on an agent card](/images/docs/platform-model/evaluation/workshop-entry.png)

## Create a task

On the agent evaluation list, click **New evaluation** and fill in:

| Field | Description |
|------|------|
| **Task name** | Name of this run |
| **Agent** | A published agent in the current tenant that has a service address. A workshop jump preselects it |
| **Service token** | The token copied when the agent was published. The job uses it to call the agent |
| **Dataset** | At least one. Search or type a path. Each sample becomes one task |
| **Framework** | `claw-eval`, or another agent framework whose name starts with `claw-eval-` |
| **Scoring** | Only the base framework `claw-eval` asks for this. Choose **Judge model** or **Code rules** |
| **Region / project / size** | The same compute request as model evaluation |

![The create page keeps the agent chosen in the workshop, and defaults the framework to claw-eval](/images/docs/platform-model/evaluation/agent-create.png)

## Dataset format

The samples in the dataset are the questions for this run: **one sample, one task**. Use JSONL, one object per line:

```json
{"query": "3 + 5? Reply with the number only.", "reference": "8"}
{"query": "Summarize in one sentence: the meeting moved to Friday 3pm.", "reference": "The meeting moved to Friday 3pm."}
```

| Field | Required | Description |
|------|----------|-------------|
| `query` | yes | The question sent to the agent |
| `reference` | no | Reference answer; used when the judge prompt is empty |
| `rubric` | no | Rubric for this sample only; overrides the page-level judge prompt |

A dataset without usable samples fails the task instead of falling back to the framework's built-in suite. If the dataset already contains claw-eval `task.yaml` files, they run as native tasks.

**Judge model** can change the judge name and set a judge prompt. An empty prompt scores against the reference answer.

![Judge-model scoring on the base framework](/images/docs/platform-model/evaluation/agent-scoring-judge.png)

**Code rules** hides the judge fields and asks for scoring code instead. Define `score(output, sample)` and return a score between 0 and 1:

```python
def score(output, sample):
    return 1.0 if sample.get("reference") in output else 0.0
```

If the code raises or has no `score` function, the task is marked as an execution error instead of silently scoring 0.

![Code-rule scoring on the base framework](/images/docs/platform-model/evaluation/agent-scoring-code.png)

`claw-eval-codex` uses its own flow, so those scoring controls stay hidden and the selected dataset is not used.

## Results

After you create the task, the **Agent Evaluation** list shows it. The second column is the agent, not a model. Status, download, and details match model evaluation.

![Agent evaluation list, with the agent in the second column](/images/docs/platform-model/evaluation/agent-list.png)

Once the task succeeds, the top of the **Evaluation report** tab shows an agent result card: tasks, average score, passed, execution errors, and total tokens. The pass line is 0.75 and each sample runs three trials by default; per-sample detail is in the download at the top of the page.

![The result card on an agent evaluation detail page](/images/docs/platform-model/evaluation/agent-result.png)

The model evaluation list does not show these tasks.

## Related documents

- [Create a Model Evaluation Task](./evaluation_create)
- [Agent Workshop](../../workshop/)
