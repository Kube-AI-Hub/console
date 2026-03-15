---
title: "自定义评测数据集"
keywords: "行业大模型平台, 自定义评测数据集, OpenCompass, EvalScope, lm-evaluation-harness"
description: "介绍如何使用自定义数据集在平台上评测模型效果，支持 OpenCompass、EvalScope 和 lm-evaluation-harness 三种框架。"
linkTitle: "自定义评测数据集"
weight: 6430
---

## 概述

平台提供的模型评测工具支持自定义评测数据集。用户可以上传自己的数据集，然后使用这些数据集评测模型效果，以满足特定业务场景下的评估需求。

## EvalScope 自定义数据集

### 选择题（MCQ）

支持 CSV 和 JSONL 格式，字段说明：

| 字段 | 是否必须 | 说明 |
|------|----------|------|
| `id` | 否 | 题目编号 |
| `question` | 是 | 题目内容 |
| `A` / `B` / `C` / `D` | 是 | 选项内容 |
| `answer` | 是 | 正确答案（如 `A`） |

CSV 示例：

```csv
id,question,A,B,C,D,answer
1,中国的首都是哪里？,北京,上海,广州,深圳,A
```

### 问答题（QA）

支持 JSONL 格式，字段说明：

| 字段 | 是否必须 | 说明 |
|------|----------|------|
| `system` | 否 | 系统提示词 |
| `query` | 是 | 问题内容 |
| `response` | 是 | 参考答案 |

JSONL 示例：

```jsonl
{"query": "什么是大语言模型？", "response": "大语言模型是基于Transformer架构训练的大规模神经网络模型..."}
```

## OpenCompass 自定义数据集

### 选择题（MCQ）

支持 `.jsonl` 和 `.csv` 格式：

```jsonl
{"question": "中国的首都是？", "A": "北京", "B": "上海", "C": "广州", "D": "深圳", "answer": "A"}
```

### 问答题（QA）

支持 `.jsonl` 和 `.csv` 格式：

```jsonl
{"question": "什么是大语言模型？", "answer": "大语言模型是..."}
```

## lm-evaluation-harness 自定义数据集

lm-evaluation-harness 使用任务配置文件（YAML）来定义评测任务，需要在数据集中包含 task YAML 文件。

数据集目录结构示例：

```
my_custom_dataset/
  task.yaml          ← 任务配置文件
  data/
    test.jsonl       ← 测试数据
```

`task.yaml` 示例：

```yaml
task: my_custom_qa
dataset_path: my_custom_dataset
dataset_name: default
output_type: generate_until
doc_to_text: "问题：{{question}}\n回答："
doc_to_target: "{{answer}}"
```

## 使用自定义数据集

1. 将自定义数据集上传至平台数据集仓库。
2. 在创建评测任务时，在**数据集选择**中搜索并选择您上传的数据集。
3. 选择对应的评测框架，确保数据集格式与框架要求匹配。

## 相关文档

- [创建模型评测任务](./evaluation_create)
- [评测框架介绍](./evaluation_framework_intro)
