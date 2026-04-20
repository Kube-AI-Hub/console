---
title: "模型推理介绍"
keywords: "行业大模型平台, 模型推理, 推理实例, vLLM, SGLang, TGI, llama.cpp"
description: "平台提供一键推理功能，帮助用户快速分配算力并启动推理服务，无需复杂的环境配置。"
linkTitle: "模型推理介绍"
weight: 6200
---

## 什么是模型推理

平台提供一键推理功能，帮助用户在支持的模型页面快速分配算力并启动推理服务，无需复杂的环境配置。

## 核心优势

- **灵活调用**：提供直观的 Web 界面进行对话测试，同时生成标准 API 接口供业务代码调用。
- **框架丰富**：支持 `vLLM`、`llama.cpp`、`SGLang`、`TGI` 等多种主流推理框架。
- **即开即用**：免去繁杂配置，自动拉起包含完整依赖的容器环境。

## 支持的推理框架

| 框架 | 特点 | 适用场景 |
|------|------|----------|
| **vLLM** | 高吞吐量、低延迟，支持连续批处理 | 生产级高并发推理服务 |
| **SGLang** | 针对结构化生成优化，支持 RadixAttention | 复杂推理和结构化输出场景 |
| **TGI（Text Generation Inference）** | Hugging Face 官方推理服务器 | 兼容 Hugging Face 生态的推理 |
| **llama.cpp** | 支持 GGUF 格式，CPU/GPU 均可运行 | 资源受限环境或 GGUF 格式模型 |

## 推理任务类型

平台支持多种推理任务类型，请参考对应文档了解 API 使用方式：

- [文本生成（Text Generation）](./inference_tasks/text-generation)
- [文本生成图像（Text to Image）](./inference_tasks/text-to-image)
- [图像文本生成（Image Text to Text）](./inference_tasks/image-text-to-text)
- [特征提取（Feature Extraction）](./inference_tasks/feature-extraction)

## 相关文档

- [创建推理实例](./endpoint_create)
- [常见问题](./endpoint_faq)
