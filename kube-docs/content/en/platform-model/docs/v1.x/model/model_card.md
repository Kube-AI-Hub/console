---
title: "Model Card"
keywords: "Industry AI Model Platform, model card, model metadata, README, model documentation"
description: "Learn what a Model Card is and how to write a well-structured Model Card to describe a model's information, usage, and tags."
linkTitle: "Model Card"
weight: 1010
---

## What is a Model Card

A Model Card is the `README.md` file in a model repository that describes the model's basic information, use cases, training process, and evaluation results. A well-written Model Card helps other users quickly understand the model's capabilities and applicable scenarios.

A Model Card consists of two parts:

- **YAML metadata header**: Located at the top of the file, wrapped by `---` delimiters, defining the model's tags and classification information.
- **Body content**: Detailed model description written in Markdown format.

## What a Model Card Should Contain

A complete Model Card should include the following sections:

| Section | Description |
|---------|-------------|
| Model Name | The official name of the model |
| Model Overview | Brief description of model type, architecture, and core capabilities |
| Usage | Code examples or invocation instructions |
| Use Cases | Tasks or problems the model is suited for |
| Training Data | Description of the dataset used for training |
| Training Process | Training framework, hyperparameters, hardware environment, etc. |
| Evaluation Results | Performance metrics on benchmark datasets |
| Limitations & Biases | Known limitations, biases, and unsuitable scenarios |

## Metadata Format

The YAML metadata is placed at the top of the `README.md` file in the following format:

```yaml
---
language:
  - zh
  - en
tags:
  - text-generation
  - conversational
license: apache-2.0
library_name: transformers
pipeline_tag: text-generation
industry_tags:
  - general
---
```

Key fields:

| Field | Description |
|-------|-------------|
| `language` | List of languages the model supports |
| `tags` | Task tags for classification and search |
| `license` | Open-source license used by the model |
| `library_name` | Framework used by the model (e.g., `transformers`, `pytorch`) |
| `pipeline_tag` | Primary task type of the model |
| `industry_tags` | Industry tags the model applies to |

## Model Card Template

Below is a complete Model Card template:

```markdown
---
language:
  - zh
  - en
tags:
  - text-generation
license: apache-2.0
library_name: transformers
pipeline_tag: text-generation
---

# Model Name

## Model Overview

Briefly describe the model architecture, parameter scale, and core capabilities.

## Usage

### Quick Start

Load and use the model with the transformers library:

from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("namespace/model-name")
tokenizer = AutoTokenizer.from_pretrained("namespace/model-name")

inputs = tokenizer("Hello", return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=100)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))

## Use Cases

- Use case one description
- Use case two description

## Training Data

Describe the training dataset and its scale.

## Training Process

Describe the training framework, hyperparameter configuration, and hardware resources.

## Evaluation Results

| Benchmark | Metric | Score |
|-----------|--------|-------|
| Dataset A | Accuracy | 0.95 |
| Dataset B | F1 | 0.92 |

## Limitations & Biases

Describe the model's known limitations and potential biases.
```

## Supported Task Tags

The platform supports the following task tags for model classification:

| Tag | Description |
|-----|-------------|
| `text-generation` | Text Generation |
| `text-classification` | Text Classification |
| `token-classification` | Token Classification (e.g., NER) |
| `question-answering` | Question Answering |
| `translation` | Translation |
| `summarization` | Summarization |
| `conversational` | Conversational |
| `fill-mask` | Fill Mask |
| `feature-extraction` | Feature Extraction |
| `image-classification` | Image Classification |
| `object-detection` | Object Detection |
| `image-segmentation` | Image Segmentation |
| `text-to-image` | Text to Image |
| `image-text-to-text` | Image-Text to Text |
| `automatic-speech-recognition` | Automatic Speech Recognition |
| `text-to-speech` | Text to Speech |
| `audio-classification` | Audio Classification |
| `sentence-similarity` | Sentence Similarity |
| `zero-shot-classification` | Zero-Shot Classification |
| `reinforcement-learning` | Reinforcement Learning |

## Supported Industry Tags

| Tag | Description |
|-----|-------------|
| `general` | General |
| `finance` | Finance |
| `healthcare` | Healthcare |
| `education` | Education |
| `legal` | Legal |
| `manufacturing` | Manufacturing |
| `energy` | Energy |
| `transportation` | Transportation |
| `agriculture` | Agriculture |
| `telecom` | Telecommunications |
| `government` | Government |

{{< notice note >}}
Model Card metadata tags are used on the platform for model classification display and search filtering. Setting accurate tags improves model discoverability.
{{</ notice >}}
