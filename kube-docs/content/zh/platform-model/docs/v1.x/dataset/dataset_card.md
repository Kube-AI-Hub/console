---
title: "数据集卡片"
keywords: "行业大模型平台, 数据集卡片, Dataset Card, 数据集元数据, README"
description: "了解数据集卡片（Dataset Card）的概念、元数据格式及编写规范，帮助用户快速理解和使用数据集。"
linkTitle: "数据集卡片"
weight: 2010
---

## 什么是数据集卡片

数据集卡片（Dataset Card）是数据集仓库根目录下的 `README.md` 文件，采用 **YAML 前置元数据 + Markdown 正文** 的格式，用于描述数据集的基本信息、用途、结构和使用方法。

数据集卡片是帮助用户快速了解数据集的核心文档。一个完善的数据集卡片应包含以下内容：

- **数据集名称与概述**：数据集的基本描述和用途说明
- **适用场景**：数据集适用的任务类型和行业场景
- **适配模型**：该数据集可用于训练或微调的模型类型
- **数据结构**：数据字段、格式及示例
- **使用方法**：加载和使用数据集的代码示例
- **创建信息**：数据来源、采集方式和标注方法
- **风险与限制**：已知的偏差、限制和使用注意事项

## 元数据格式

数据集卡片使用 YAML 前置元数据块定义结构化信息，平台会自动解析并展示这些元数据。YAML 块位于文件开头，由 `---` 分隔：

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

## 数据集卡片模板

以下是推荐的数据集卡片完整模板：

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

# 数据集名称

## 数据集描述

简要说明数据集的内容、来源和用途。

## 适用场景

- 文本分类
- 情感分析
- 模型微调

## 数据结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| text | string | 输入文本 |
| label | int | 类别标签 |

示例数据：

\```json
{
  "text": "这款产品使用体验很好",
  "label": 1
}
\```

## 使用方法

\```python
from pycsghub.snapshot_download import snapshot_download

dataset_path = snapshot_download(
    repo_id="<命名空间>/<数据集名称>",
    repo_type="dataset",
    endpoint="https://<平台地址>",
    token="<访问令牌>"
)
\```

## 创建信息

- **数据来源**：说明数据的采集来源
- **采集方式**：描述数据的采集和处理方法
- **标注方法**：说明数据标注的方式和标准
- **数据规模**：数据条目总数

## 风险与限制

说明数据集的已知偏差、限制条件和使用时的注意事项。
```

{{< notice note >}}
模板中的代码块示例使用了 `\`` 转义符以避免渲染冲突。实际编写时，请使用标准的三个反引号。
{{</ notice >}}

## 数据集任务标签

在元数据的 `task_categories` 字段中，可使用以下标准任务标签：

| 标签 | 说明 |
|------|------|
| `text-classification` | 文本分类 |
| `token-classification` | 词元分类（如命名实体识别） |
| `question-answering` | 问答 |
| `summarization` | 文本摘要 |
| `translation` | 机器翻译 |
| `text-generation` | 文本生成 |
| `text2text-generation` | 文本到文本生成 |
| `fill-mask` | 填充掩码 |
| `sentence-similarity` | 句子相似度 |
| `conversational` | 对话 |
| `table-question-answering` | 表格问答 |
| `image-classification` | 图像分类 |
| `object-detection` | 目标检测 |
| `image-segmentation` | 图像分割 |
| `image-to-text` | 图像到文本 |
| `text-to-image` | 文本到图像 |
| `visual-question-answering` | 视觉问答 |
| `automatic-speech-recognition` | 语音识别 |
| `audio-classification` | 音频分类 |
| `text-to-speech` | 文本转语音 |
| `video-classification` | 视频分类 |
| `reinforcement-learning` | 强化学习 |
| `feature-extraction` | 特征提取 |

## 行业标签

在元数据的 `tags` 字段中，可使用行业标签标识数据集的应用领域：

| 标签 | 说明 |
|------|------|
| `finance` | 金融 |
| `healthcare` | 医疗健康 |
| `education` | 教育 |
| `legal` | 法律 |
| `government` | 政务 |
| `manufacturing` | 制造业 |
| `retail` | 零售 |
| `energy` | 能源 |
| `transportation` | 交通运输 |
| `agriculture` | 农业 |
| `general` | 通用 |

{{< notice tip >}}
合理设置任务标签和行业标签，可以帮助其他用户更快地发现和筛选数据集。
{{</ notice >}}
