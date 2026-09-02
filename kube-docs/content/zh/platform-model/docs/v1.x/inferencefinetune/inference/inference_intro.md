---
title: "模型推理介绍"
keywords: "行业大模型平台, 模型推理, 推理实例, vLLM, SGLang, TGI, llama.cpp"
description: "平台提供一键推理功能，帮助用户快速分配算力并启动推理服务，无需复杂的环境配置。"
linkTitle: "模型推理介绍"
weight: 6200
---

## 什么是模型推理

平台提供一键推理功能，帮助用户在支持的模型页面快速分配算力并启动推理服务，无需复杂的环境配置。导航 **模型推理** 下有两类入口：

| 入口 | 说明 |
|------|------|
| **[公共推理服务](./serverless_intro)** | 管理员预置的共享服务。包含集群内本地部署，以及经统一网关转发的云端 API 模型 |
| **[推理实例](./endpoint_create)** | 用户为自己选定的模型独占部署，可配置规格、框架、副本和量化 |

## 核心优势

- **灵活调用**：提供直观的 Web 界面进行对话测试，同时生成标准 API 接口供业务代码调用。
- **框架丰富**：支持 `vLLM`、`llama.cpp`、`SGLang`、`TGI` 等多种主流推理框架。
- **即开即用**：免去繁杂配置，自动拉起包含完整依赖的容器环境。
- **显存选型**：创建推理实例时显示**推荐最小显存**，并与规格标称显存对比。
- **双模接入**：公共推理同时覆盖本地部署与云端 API，调用方式统一为 OpenAI 兼容接口。

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

- [公共推理服务介绍](./serverless_intro)
- [使用公共推理服务](./serverless_usage)
- [管理公共推理服务](./serverless_admin)
- [创建推理实例](./endpoint_create)
- [使用推理实例](./endpoint_usage)
- [常见问题](./endpoint_faq)
