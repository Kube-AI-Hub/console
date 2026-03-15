---
title: "模型仓库"
keywords: "行业大模型平台, 模型仓库, 模型管理, 上传模型, 下载模型"
description: "模型仓库（Model Hub）是对模型进行托管的地方，以便对模型进行存储、管理、发现和共享。"
linkTitle: "模型仓库"
weight: 1000
icon: "/images/docs/platform-model/model.svg"
---

## 什么是模型仓库

模型仓库（Model Hub）是对模型进行托管的地方，以便对模型进行存储、管理、发现和共享。用户可以在模型仓库中创建自己的模型仓库（Model Repository），上传、下载并管理模型文件，同时也可以从模型仓库中探索、获取和使用其他开放模型。

## 核心功能

- **模型上传与管理**：支持通过 Web 界面、Git 命令行或 SDK 上传模型文件，包括大文件（通过 Git LFS）。
- **版本控制**：基于 Git 对模型文件进行版本管理，支持查看历史版本与回滚。
- **模型发现**：通过标签、任务类型、框架等维度检索和浏览开放模型。
- **权限控制**：支持公开和私有两种可见性设置，私有模型仅授权用户可访问。
- **模型部署**：支持一键将模型部署为专属推理实例，或发起微调训练。

## 支持的模型格式

平台兼容主流模型格式，包括：

- Hugging Face Transformers 格式（`config.json`、`pytorch_model.bin`、`.safetensors` 等）
- GGUF 格式（适用于 llama.cpp）
- 其他通用模型权重文件

## 相关操作

- [下载模型](./download_models)
