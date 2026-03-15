---
title: "评测框架介绍"
keywords: "行业大模型平台, 评测框架, OpenCompass, EvalScope, lm-evaluation-harness"
description: "介绍平台支持的三种主流模型评测框架：lm-evaluation-harness、OpenCompass 和 EvalScope。"
linkTitle: "评测框架介绍"
weight: 6420
---

## 支持的评测框架

平台提供三个主流评测框架供用户选择：**lm-evaluation-harness**、**OpenCompass**、**EvalScope**。

## 框架对比

| 特点 | lm-evaluation-harness | OpenCompass | EvalScope |
|------|----------------------|-------------|-----------|
| 任务范围 | 全球化（英文为主） | 特别关注中文 | 特别关注中文 |
| 模型支持 | 开源 + API 模型 | 开源 + 国内商用模型 | 开源 + 国内商用模型 |
| 适用场景 | 学术研究，英文模型对比 | 中文任务，国内外模型比较 | 中文任务，数据集较新 |
| 扩展性 | 较高，偏技术性 | 用户友好 | 用户友好 |

## lm-evaluation-harness

EleutherAI 开发的 Python 评测工具，提供标准化评测流程，支持 NLP 多种任务（文本生成、完形填空、问答、翻译），适合英文或全球化学术研究场景。

**内置基准测试（部分）**：MMLU、HellaSwag、ARC、TruthfulQA、WinoGrande 等。

## OpenCompass

开源评测框架，特别针对中文大语言模型评测进行优化，支持中文基准测试（如 CEVAL、CLUE），兼容国内主流模型，适合中文任务评估。

**内置基准测试（部分）**：C-Eval、CMMLU、MMLU、GSM8K、HumanEval 等。

## EvalScope

魔搭社区出品的评测框架，内置 MMLU、CMMLU、C-Eval、GSM8K 等基准，支持大语言模型、多模态模型、Embedding 模型、AIGC 模型，适合中文任务和使用最新数据集的场景。

**内置基准测试（部分）**：C-Eval、CMMLU、MMLU、GSM8K、ARC、HellaSwag 等。

## 如何选择框架

- 评测**英文模型**或做**学术对比**研究 → 推荐 **lm-evaluation-harness**
- 评测**中文模型**，关注**国内基准** → 推荐 **OpenCompass** 或 **EvalScope**
- 使用**自定义数据集**评测 → 三个框架均支持，参考[自定义评测数据集](./evaluation_with_custom_dataset)

## 相关文档

- [创建模型评测任务](./evaluation_create)
- [自定义评测数据集](./evaluation_with_custom_dataset)
