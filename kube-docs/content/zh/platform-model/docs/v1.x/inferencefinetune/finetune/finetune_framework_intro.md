---
title: "微调框架介绍"
keywords: "行业大模型平台, 微调框架, LLaMA-Factory, MS-Swift, LoRA, QLoRA, 全参数微调"
description: "介绍行业大模型平台支持的微调框架，包括 LLaMA-Factory 和 MS-Swift 的核心特性、适用场景和对比分析。"
linkTitle: "微调框架介绍"
weight: 6330
---

行业大模型平台支持多种主流微调框架，帮助您在不同场景下高效完成模型微调训练。本文介绍平台当前支持的微调框架及其核心特性。

## LLaMA-Factory

[LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) 是统一的大语言模型微调框架，支持 100+ 种 LLM 和 VLM 模型，提供从数据准备到模型导出的一站式微调解决方案。

### 核心特性

- **广泛模型支持**：支持 100+ 种大语言模型和视觉语言模型，包括 Llama、QWen、ChatGLM、Baichuan、DeepSeek 等
- **多种微调方法**：LoRA、QLoRA（4-bit 量化微调）、全参数微调
- **可视化 Web UI（LlamaBoard）**：无代码操作界面，支持数据集选择、参数配置、训练监控和模型导出
- **高性能训练**：LoRA 微调速度比 ChatGLM P-Tuning 快 3.7 倍
- **4-bit 量化支持**：通过 QLoRA 在消费级 GPU 上完成大模型微调
- **灵活的数据集管理**：支持自定义数据格式，内置多种数据预处理模板

### 适用场景

- 快速上手模型微调，无需编写训练代码
- 需要可视化界面管理训练任务
- 显存有限场景下的高效微调（QLoRA）
- 多模型、多方法的批量实验对比

### 相关链接

- [GitHub](https://github.com/hiyouga/LLaMA-Factory)
- [文档](https://llamafactory.readthedocs.io/)

---

## MS-Swift

[MS-Swift](https://github.com/modelscope/ms-swift) 是 ModelScope 推出的大模型微调与推理框架，支持 PEFT 和全参数微调，兼容国内外主流大模型。

### 核心特性

- **PEFT 与全参数微调**：支持 LoRA、QLoRA、全参数微调等多种训练方式
- **广泛模型兼容**：支持国内外主流大模型，包括通义千问、ChatGLM、Llama、Mistral 等
- **嵌入模型微调**：支持 Embedding 模型的微调训练，适用于搜索和检索增强场景
- **GRPO 算法支持**：集成 Group Relative Policy Optimization 算法，支持对齐训练
- **LMDeploy 集成**：与 LMDeploy 推理框架无缝集成，支持训练后直接部署
- **CLI 驱动**：通过命令行完成全部训练和导出流程，便于脚本化和自动化

### 适用场景

- 需要灵活使用 CLI 完成训练流程
- 使用 ModelScope 生态的模型和数据集
- 嵌入模型微调和 RAG 应用场景
- 需要 GRPO 等对齐训练算法
- 训练后通过 LMDeploy 快速部署推理服务

### 相关链接

- [GitHub](https://github.com/modelscope/ms-swift)
- [文档](https://swift.readthedocs.io/)

---

## 框架对比

| 对比维度 | LLaMA-Factory | MS-Swift |
|----------|---------------|----------|
| **微调方法** | LoRA、QLoRA、全参数微调 | LoRA、QLoRA、全参数微调 |
| **可视化界面** | LlamaBoard Web UI | 无（CLI 驱动） |
| **支持模型数** | 100+ 种 LLM 和 VLM | 广泛支持国内外主流模型 |
| **特色功能** | 无代码训练、3.7x LoRA 加速 | 嵌入模型微调、GRPO 算法、LMDeploy 集成 |
| **适用场景** | 快速上手、可视化管理 | CLI 自动化、ModelScope 生态 |
| **导出能力** | Web UI 一键导出到 CSGHub | CLI 导出并推送到仓库 |

{{< notice tip >}}
如果您希望快速上手微调并通过可视化界面管理训练，推荐使用 **LLaMA-Factory**。如果您需要更灵活的 CLI 控制或使用 ModelScope 生态，推荐使用 **MS-Swift**。
{{</ notice >}}
