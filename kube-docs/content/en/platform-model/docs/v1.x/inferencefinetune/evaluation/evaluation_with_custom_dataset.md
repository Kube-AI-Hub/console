---
title: "Custom Evaluation Datasets"
keywords: "Industry AI Model Platform, custom evaluation datasets, OpenCompass, EvalScope, lm-evaluation-harness"
description: "How to use custom datasets to evaluate model performance on the platform, supporting OpenCompass, EvalScope, and lm-evaluation-harness frameworks."
linkTitle: "Custom Evaluation Datasets"
weight: 6430
---

## Overview

The platform's model evaluation tool supports custom evaluation datasets. Users can upload their own datasets and use them to evaluate model performance to meet specific business scenario assessment needs.

## EvalScope Custom Datasets

### Multiple Choice Questions (MCQ)

Supports CSV and JSONL formats:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | No | Question ID |
| `question` | Yes | Question content |
| `A` / `B` / `C` / `D` | Yes | Option content |
| `answer` | Yes | Correct answer (e.g., `A`) |

CSV example:

```csv
id,question,A,B,C,D,answer
1,What is the capital of France?,Paris,London,Berlin,Madrid,A
```

### Open-ended Q&A

Supports JSONL format:

| Field | Required | Description |
|-------|----------|-------------|
| `system` | No | System prompt |
| `query` | Yes | Question content |
| `response` | Yes | Reference answer |

JSONL example:

```jsonl
{"query": "What is a large language model?", "response": "A large language model is a large-scale neural network model based on the Transformer architecture..."}
```

## OpenCompass Custom Datasets

### Multiple Choice Questions (MCQ)

Supports `.jsonl` and `.csv` formats:

```jsonl
{"question": "What is the capital of France?", "A": "Paris", "B": "London", "C": "Berlin", "D": "Madrid", "answer": "A"}
```

### Open-ended Q&A

Supports `.jsonl` and `.csv` formats:

```jsonl
{"question": "What is a large language model?", "answer": "A large language model is..."}
```

## lm-evaluation-harness Custom Datasets

lm-evaluation-harness uses task configuration files (YAML) to define evaluation tasks. The dataset must include a task YAML file.

Example dataset directory structure:

```
my_custom_dataset/
  task.yaml          ← Task configuration file
  data/
    test.jsonl       ← Test data
```

Example `task.yaml`:

```yaml
task: my_custom_qa
dataset_path: my_custom_dataset
dataset_name: default
output_type: generate_until
doc_to_text: "Question: {{question}}\nAnswer:"
doc_to_target: "{{answer}}"
```

## Using Custom Datasets

1. Upload the custom dataset to the platform's dataset repository.
2. When creating an evaluation task, search and select your uploaded dataset in the **Dataset Selection** field.
3. Select the corresponding evaluation framework, ensuring the dataset format matches the framework's requirements.

## Related Documentation

- [Create Model Evaluation Task](./evaluation_create)
- [Evaluation Framework Overview](./evaluation_framework_intro)
