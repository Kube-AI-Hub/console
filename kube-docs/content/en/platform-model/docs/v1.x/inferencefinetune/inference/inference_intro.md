---
title: "Model Inference Overview"
keywords: "Industry AI Model Platform, model inference, dedicated instances, vLLM, SGLang, TGI, llama.cpp"
description: "The platform provides one-click inference to help users quickly allocate compute and start inference services without complex configuration."
linkTitle: "Model Inference Overview"
weight: 6200
---

## What is Model Inference

The platform provides one-click inference functionality, helping users quickly allocate compute and start inference services on supported model pages — no complex environment configuration needed.

## Core Advantages

- **Flexible Invocation**: Provides an intuitive web interface for conversation testing, while also generating standard API interfaces for business code integration.
- **Rich Framework Support**: Supports multiple mainstream inference frameworks including `vLLM`, `llama.cpp`, `SGLang`, and `TGI`.
- **Instantly Available**: Eliminates complex configuration by automatically launching container environments with all required dependencies.

## Supported Inference Frameworks

| Framework | Features | Best For |
|-----------|----------|----------|
| **vLLM** | High throughput, low latency, supports continuous batching | Production-grade high-concurrency inference services |
| **SGLang** | Optimized for structured generation, supports RadixAttention | Complex reasoning and structured output scenarios |
| **TGI (Text Generation Inference)** | Hugging Face's official inference server | Inference within the Hugging Face ecosystem |
| **llama.cpp** | Supports GGUF format, runs on both CPU and GPU | Resource-constrained environments or GGUF format models |

## Inference Task Types

The platform supports multiple inference task types — refer to the corresponding documentation for API usage:

- [Text Generation](./inference_tasks/text-generation)
- [Text to Image](./inference_tasks/text-to-image)
- [Image Text to Text](./inference_tasks/image-text-to-text)
- [Feature Extraction](./inference_tasks/feature-extraction)

## Related Documentation

- [Create Dedicated Inference Instance](./endpoint_create)
- [FAQ](./endpoint_faq)
