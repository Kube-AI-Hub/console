---
title: "Evaluation Framework Overview"
keywords: "Industry AI Model Platform, evaluation frameworks, OpenCompass, EvalScope, lm-evaluation-harness"
description: "Overview of the three mainstream evaluation frameworks supported by the platform: lm-evaluation-harness, OpenCompass, and EvalScope."
linkTitle: "Evaluation Framework Overview"
weight: 6420
---

## Supported Evaluation Frameworks

The platform provides three mainstream evaluation frameworks: **lm-evaluation-harness**, **OpenCompass**, and **EvalScope**.

## Framework Comparison

| Feature | lm-evaluation-harness | OpenCompass | EvalScope |
|---------|----------------------|-------------|-----------|
| Task Scope | Global (primarily English) | Special focus on Chinese | Special focus on Chinese |
| Model Support | Open-source + API models | Open-source + domestic commercial models | Open-source + domestic commercial models |
| Best For | Academic research, English model comparison | Chinese tasks, domestic/international model comparison | Chinese tasks, newer datasets |
| Extensibility | High, more technical | User-friendly | User-friendly |

## lm-evaluation-harness

A Python evaluation tool developed by EleutherAI, providing standardized evaluation pipelines and supporting multiple NLP tasks (text generation, fill-in-the-blank, Q&A, translation). Best suited for English or global academic research.

**Built-in benchmarks (partial)**: MMLU, HellaSwag, ARC, TruthfulQA, WinoGrande, and more.

## OpenCompass

An open-source evaluation framework specifically optimized for Chinese large language model evaluation, supporting Chinese benchmarks (e.g., CEVAL, CLUE) and compatible with mainstream domestic models. Suitable for Chinese task evaluation.

**Built-in benchmarks (partial)**: C-Eval, CMMLU, MMLU, GSM8K, HumanEval, and more.

## EvalScope

An evaluation framework from the ModelScope community with built-in MMLU, CMMLU, C-Eval, GSM8K, and other benchmarks. Supports large language models, multimodal models, Embedding models, and AIGC models. Suitable for Chinese tasks with newer datasets.

**Built-in benchmarks (partial)**: C-Eval, CMMLU, MMLU, GSM8K, ARC, HellaSwag, and more.

## How to Choose a Framework

- Evaluating **English models** or conducting **academic comparisons** → Recommend **lm-evaluation-harness**
- Evaluating **Chinese models** focused on **domestic benchmarks** → Recommend **OpenCompass** or **EvalScope**
- Using **custom datasets** → All three frameworks support this; refer to [Custom Evaluation Datasets](./evaluation_with_custom_dataset)

## Related Documentation

- [Create Model Evaluation Task](./evaluation_create)
- [Custom Evaluation Datasets](./evaluation_with_custom_dataset)
