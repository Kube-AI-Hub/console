---
title: "Notebook 实例介绍"
keywords: "行业大模型平台, Notebook, JupyterLab, VS Code, Eclipse Theia, 交互式开发"
description: "通过 Notebook 实例功能，用户可一键创建独立的计算环境，直接使用平台算力资源进行数据分析、模型训练和实验。"
linkTitle: "Notebook 实例介绍"
weight: 6100
---

## 什么是 Notebook 实例

Notebook 实例提供一键式交互式开发环境，用户可直接使用平台算力资源进行数据分析、模型训练和实验，无需自行配置环境，即开即用，高效便捷，支持快速迭代和交互式开发。

## 支持的开发环境

平台提供以下三种交互式开发环境：

| 环境 | 说明 |
|------|------|
| **JupyterLab** | 功能丰富的交互式笔记本环境，支持 Python、R 等多种语言，适合数据分析和模型实验 |
| **VS Code** | 基于浏览器的 Visual Studio Code，提供完整的 IDE 体验，适合代码开发和调试 |
| **Eclipse Theia** | 开源的云端 IDE，提供类 VS Code 的开发体验，适合团队协作开发 |

## 核心特性

- **即开即用**：无需手动配置 Python 环境、CUDA 驱动或深度学习框架，选择预装镜像即可直接使用。
- **算力弹性**：按需选择 GPU/CPU 资源配置，用完即停，节省算力成本。
- **数据集集成**：可直接在 Notebook 中访问平台上的模型和数据集仓库。
- **持久化存储**：Notebook 工作目录支持持久化，关闭实例后数据不丢失。

## 使用流程

```
创建 Notebook 实例
       ↓
选择开发环境（JupyterLab / VS Code / Eclipse Theia）
       ↓
选择预装镜像和算力配置
       ↓
实例启动后在浏览器中打开开发环境
       ↓
完成开发后停止或删除实例
```

## 相关文档

- [创建 Notebook 实例](./notebook_create)
