---
title: "Dataset Card"
keywords: "Industry AI Model Platform, Dataset Card, dataset metadata, README"
description: "Learn about Dataset Cards — their purpose, metadata format, and how to write one to help users understand and use your dataset."
linkTitle: "Dataset Card"
weight: 2010
---

## What is a Dataset Card

A Dataset Card is the `README.md` file in the root directory of a dataset repository. It uses **YAML front-matter metadata + Markdown body** to describe a dataset's basic information, purpose, structure, and usage.

The Dataset Card is the key document that helps users quickly understand a dataset. A well-written Dataset Card should include:

- **Name and overview**: A basic description and purpose of the dataset
- **Use cases**: Task types and industry scenarios the dataset applies to
- **Compatible models**: Model types the dataset can be used to train or fine-tune
- **Data structure**: Fields, formats, and sample entries
- **Usage instructions**: Code examples for loading and using the dataset
- **Creation information**: Data sources, collection methods, and annotation process
- **Risks and limitations**: Known biases, limitations, and usage considerations

## Metadata Format

Dataset Cards use a YAML front-matter block to define structured information. The platform automatically parses and displays this metadata. The YAML block is placed at the beginning of the file, delimited by `---`:

```yaml
---
language:
  - zh
  - en
tags:
  - text-classification
  - sentiment-analysis
task_categories:
  - text-classification
size_categories:
  - 10K<n<100K
license: apache-2.0
---
```

## Dataset Card Template

Below is the recommended full template for a Dataset Card:

```markdown
---
language:
  - zh
tags:
  - text-classification
task_categories:
  - text-classification
size_categories:
  - 1K<n<10K
license: apache-2.0
---

# Dataset Name

## Dataset Description

Briefly describe the content, source, and purpose of the dataset.

## Use Cases

- Text classification
- Sentiment analysis
- Model fine-tuning

## Data Structure

| Field | Type | Description |
|-------|------|-------------|
| text | string | Input text |
| label | int | Category label |

Sample data:

\```json
{
  "text": "This product has a great user experience",
  "label": 1
}
\```

## Usage

\```python
from pycsghub.snapshot_download import snapshot_download

dataset_path = snapshot_download(
    repo_id="<namespace>/<dataset-name>",
    repo_type="dataset",
    endpoint="https://<platform-host>",
    token="<access-token>"
)
\```

## Creation Information

- **Data source**: Where the data was collected from
- **Collection method**: How the data was gathered and processed
- **Annotation method**: How the data was labeled and quality-checked
- **Dataset size**: Total number of entries

## Risks and Limitations

Describe known biases, limitations, and important considerations for using this dataset.
```

{{< notice note >}}
Code blocks in the template above use `\`` escape characters to avoid rendering conflicts. When writing your actual Dataset Card, use standard triple backticks.
{{</ notice >}}

## Dataset Task Tags

Use the following standard task tags in the `task_categories` metadata field:

| Tag | Description |
|-----|-------------|
| `text-classification` | Text classification |
| `token-classification` | Token classification (e.g., named entity recognition) |
| `question-answering` | Question answering |
| `summarization` | Text summarization |
| `translation` | Machine translation |
| `text-generation` | Text generation |
| `text2text-generation` | Text-to-text generation |
| `fill-mask` | Fill mask |
| `sentence-similarity` | Sentence similarity |
| `conversational` | Conversational |
| `table-question-answering` | Table question answering |
| `image-classification` | Image classification |
| `object-detection` | Object detection |
| `image-segmentation` | Image segmentation |
| `image-to-text` | Image to text |
| `text-to-image` | Text to image |
| `visual-question-answering` | Visual question answering |
| `automatic-speech-recognition` | Automatic speech recognition |
| `audio-classification` | Audio classification |
| `text-to-speech` | Text to speech |
| `video-classification` | Video classification |
| `reinforcement-learning` | Reinforcement learning |
| `feature-extraction` | Feature extraction |

## Industry Tags

Use industry tags in the `tags` metadata field to identify the dataset's application domain:

| Tag | Description |
|-----|-------------|
| `finance` | Finance |
| `healthcare` | Healthcare |
| `education` | Education |
| `legal` | Legal |
| `government` | Government |
| `manufacturing` | Manufacturing |
| `retail` | Retail |
| `energy` | Energy |
| `transportation` | Transportation |
| `agriculture` | Agriculture |
| `general` | General purpose |

{{< notice tip >}}
Setting appropriate task tags and industry tags helps other users discover and filter datasets more easily.
{{</ notice >}}
