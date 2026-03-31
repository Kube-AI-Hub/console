---
title: "Fine-tuning Framework Overview"
keywords: "Industry AI Model Platform, fine-tuning framework, LLaMA-Factory, MS-Swift, LoRA, QLoRA, full-parameter fine-tuning"
description: "Overview of fine-tuning frameworks supported by the Industry AI Model Platform, including LLaMA-Factory and MS-Swift features, use cases, and comparison."
linkTitle: "Fine-tuning Framework Overview"
weight: 6330
---

The Industry AI Model Platform supports several mainstream fine-tuning frameworks to help you efficiently complete model fine-tuning across different scenarios. This page introduces the currently supported frameworks and their core features.

## LLaMA-Factory

[LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) is a unified LLM fine-tuning framework supporting 100+ LLMs and VLMs, providing an end-to-end solution from data preparation to model export.

### Key Features

- **Broad Model Support**: Supports 100+ LLMs and vision-language models, including Llama, QWen, ChatGLM, Baichuan, DeepSeek, and more
- **Multiple Fine-tuning Methods**: LoRA, QLoRA (4-bit quantized fine-tuning), full-parameter fine-tuning
- **Visual Web UI (LlamaBoard)**: No-code interface for dataset selection, parameter configuration, training monitoring, and model export
- **High-Performance Training**: LoRA fine-tuning is 3.7x faster compared to ChatGLM P-Tuning
- **4-bit Quantization Support**: Fine-tune large models on consumer-grade GPUs via QLoRA
- **Flexible Dataset Management**: Supports custom data formats with built-in data preprocessing templates

### Best For

- Quick-start model fine-tuning without writing training code
- Visual interface for managing training tasks
- Efficient fine-tuning in memory-constrained scenarios (QLoRA)
- Batch experiment comparison across multiple models and methods

### Links

- [GitHub](https://github.com/hiyouga/LLaMA-Factory)
- [Docs](https://llamafactory.readthedocs.io/)

---

## MS-Swift

[MS-Swift](https://github.com/modelscope/ms-swift) is a large model fine-tuning and inference framework from ModelScope, supporting PEFT and full-parameter fine-tuning with broad compatibility across domestic and international models.

### Key Features

- **PEFT and Full-Parameter Fine-tuning**: Supports LoRA, QLoRA, full-parameter fine-tuning, and more
- **Broad Model Compatibility**: Compatible with major domestic and international LLMs, including QWen, ChatGLM, Llama, Mistral, and others
- **Embedding Model Fine-tuning**: Supports fine-tuning of embedding models for search and RAG scenarios
- **GRPO Algorithm Support**: Integrated Group Relative Policy Optimization for alignment training
- **LMDeploy Integration**: Seamless integration with the LMDeploy inference framework for direct deployment after training
- **CLI-Driven**: Complete all training and export workflows via command line, enabling scripting and automation

### Best For

- Flexible CLI-based training workflows
- Working within the ModelScope ecosystem for models and datasets
- Embedding model fine-tuning and RAG applications
- Alignment training with GRPO or similar algorithms
- Rapid deployment via LMDeploy after training

### Links

- [GitHub](https://github.com/modelscope/ms-swift)
- [Docs](https://swift.readthedocs.io/)

---

## Framework Comparison

| Dimension | LLaMA-Factory | MS-Swift |
|-----------|---------------|----------|
| **Fine-tuning Methods** | LoRA, QLoRA, full-parameter | LoRA, QLoRA, full-parameter |
| **Visual Interface** | LlamaBoard Web UI | None (CLI-driven) |
| **Supported Models** | 100+ LLMs and VLMs | Broad domestic and international model support |
| **Key Features** | No-code training, 3.7x LoRA speedup | Embedding fine-tuning, GRPO algorithm, LMDeploy integration |
| **Best For** | Quick start, visual management | CLI automation, ModelScope ecosystem |
| **Export Capability** | One-click export to CSGHub via Web UI | CLI export and push to repository |

{{< notice tip >}}
If you want to get started quickly with fine-tuning and manage training through a visual interface, **LLaMA-Factory** is recommended. If you need more flexible CLI control or work within the ModelScope ecosystem, **MS-Swift** is the better choice.
{{</ notice >}}
