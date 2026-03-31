---
title: "模型卡片"
keywords: "行业大模型平台, 模型卡片, Model Card, 模型元数据, README"
description: "了解什么是模型卡片（Model Card），以及如何编写规范的模型卡片来描述模型的基本信息、用途和标签。"
linkTitle: "模型卡片"
weight: 1010
---

## 什么是模型卡片

模型卡片（Model Card）是模型仓库中的 `README.md` 文件，用于描述模型的基本信息、使用场景、训练过程和评估结果等关键内容。一张完整的模型卡片可以帮助其他用户快速了解模型的能力和适用范围。

模型卡片由两部分组成：

- **YAML 元数据头**：位于文件顶部，用 `---` 分隔符包裹，定义模型的标签和分类信息。
- **正文内容**：使用 Markdown 格式编写的模型详细描述。

## 模型卡片应包含的内容

一张完整的模型卡片建议包含以下章节：

| 章节 | 说明 |
|------|------|
| 模型名称 | 模型的正式名称 |
| 模型概述 | 简要说明模型的类型、架构和核心能力 |
| 使用方法 | 代码示例或调用说明 |
| 适用场景 | 模型适合解决哪些任务或问题 |
| 训练数据 | 用于训练模型的数据集描述 |
| 训练过程 | 训练框架、超参数、硬件环境等 |
| 评估结果 | 模型在基准数据集上的性能指标 |
| 限制与偏差 | 模型的已知限制、偏差和不适用场景 |

## 元数据格式

模型卡片的 YAML 元数据位于 `README.md` 文件顶部，格式如下：

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

主要字段说明：

| 字段 | 说明 |
|------|------|
| `language` | 模型支持的语言列表 |
| `tags` | 模型的任务标签，用于分类和检索 |
| `license` | 模型使用的开源许可证 |
| `library_name` | 模型使用的框架（如 `transformers`、`pytorch`） |
| `pipeline_tag` | 模型的主要任务类型 |
| `industry_tags` | 模型适用的行业标签 |

## 模型卡片模板

以下是一个完整的模型卡片模板示例：

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

# 模型名称

## 模型概述

简要描述模型的架构、参数规模和核心能力。

## 使用方法

### 快速开始

通过 transformers 库加载和使用本模型：

from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("namespace/model-name")
tokenizer = AutoTokenizer.from_pretrained("namespace/model-name")

inputs = tokenizer("你好", return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=100)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))

## 适用场景

- 场景一描述
- 场景二描述

## 训练数据

描述用于训练的数据集及其规模。

## 训练过程

描述训练框架、超参数配置和所用硬件资源。

## 评估结果

| 基准数据集 | 指标 | 得分 |
|-----------|------|------|
| 数据集A | Accuracy | 0.95 |
| 数据集B | F1 | 0.92 |

## 限制与偏差

说明模型的已知限制和潜在偏差。
```

## 支持的任务标签

平台支持以下任务标签（task tags），用于对模型进行分类：

| 标签 | 说明 |
|------|------|
| `text-generation` | 文本生成 |
| `text-classification` | 文本分类 |
| `token-classification` | 词元分类（如命名实体识别） |
| `question-answering` | 问答 |
| `translation` | 翻译 |
| `summarization` | 摘要 |
| `conversational` | 对话 |
| `fill-mask` | 掩码填充 |
| `feature-extraction` | 特征提取 |
| `image-classification` | 图像分类 |
| `object-detection` | 目标检测 |
| `image-segmentation` | 图像分割 |
| `text-to-image` | 文本生成图像 |
| `image-text-to-text` | 图文生成文本 |
| `automatic-speech-recognition` | 自动语音识别 |
| `text-to-speech` | 文本转语音 |
| `audio-classification` | 音频分类 |
| `sentence-similarity` | 句子相似度 |
| `zero-shot-classification` | 零样本分类 |
| `reinforcement-learning` | 强化学习 |

## 支持的行业标签

| 标签 | 说明 |
|------|------|
| `general` | 通用 |
| `finance` | 金融 |
| `healthcare` | 医疗健康 |
| `education` | 教育 |
| `legal` | 法律 |
| `manufacturing` | 制造业 |
| `energy` | 能源 |
| `transportation` | 交通运输 |
| `agriculture` | 农业 |
| `telecom` | 电信 |
| `government` | 政务 |

{{< notice note >}}
模型卡片的元数据标签会在平台上用于模型的分类展示和搜索过滤。建议为模型设置准确的标签以提高可发现性。
{{</ notice >}}
