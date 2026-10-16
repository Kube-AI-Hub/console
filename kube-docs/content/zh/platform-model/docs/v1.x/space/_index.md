---
title: "用户空间"
keywords: "行业大模型平台, 用户空间, Space, Gradio, Streamlit, AI应用"
description: "用户空间（Space）是大模型应用的展示平台，开发者可以在用户空间中自行搭建和展示不同的AI应用。"
linkTitle: "用户空间"
weight: 4000
icon: "/images/docs/platform-model/space.svg"
---

## 什么是用户空间

用户空间（Space）是大模型应用的展示平台，开发者可以在用户空间中自行搭建和展示不同的 AI 应用，包括多种模型组合、可视化的交互展现形式等，为开发者提供一个能力展示平台。

## 支持的应用类型

| 应用类型 | 说明 |
|----------|------|
| Gradio | 基于 Gradio 框架构建的交互式 ML 演示应用 |
| Streamlit | 基于 Streamlit 框架构建的数据应用 |
| Docker | 自定义 Docker 镜像部署的任意 Web 应用 |
| Nginx | 静态网站托管 |
| MCP 应用 | 基于 Model Context Protocol 的工具服务 |

## 核心特性

- **互动性**：提供用户与模型交互的 Web 界面。
- **简易部署**：用户只需上传代码，平台自动构建、部署和托管运行。
- **私有化**：支持设置为公开或私有，适合企业或个人环境使用。
- **版本管理**：应用代码基于 Git 管理，支持版本回溯。

## 快速开始（Gradio）

1. 在平台创建一个新的用户空间，选择 **Gradio** 类型。
2. 克隆用户空间仓库到本地：
   ```bash
   git clone https://<平台地址>/<命名空间>/<应用名称>
   ```
3. 创建 `app.py` 文件：
   ```python
   import gradio as gr

   def greet(name):
       return f"Hello, {name}!"

   demo = gr.Interface(fn=greet, inputs="text", outputs="text")
   demo.launch()
   ```
4. 提交并推送代码，平台将自动构建和部署：
   ```bash
   git add app.py
   git commit -m "Add Gradio app"
   git push
   ```

## 快速开始（Streamlit）

1. 在平台创建一个新的用户空间，选择 **Streamlit** 类型。
2. 克隆并创建 `app.py` 文件：
   ```python
   import streamlit as st

   st.title("我的 AI 应用")
   user_input = st.text_input("输入文本")
   if user_input:
       st.write(f"您输入了：{user_input}")
   ```
3. 提交并推送代码，平台自动部署。

## 详情页页签

进入空间详情（`/spaces/:namespace/:name`）后，顶部页签包括：

| 页签 | 路径 | 内容 |
|------|------|------|
| 应用 | 默认 | 运行状态、访问地址、构建日志入口 |
| 分析 | `?tab=analysis` | 实例的资源使用与访问趋势 |
| 文件 | `?tab=files` | 浏览、上传、新建文件，查看提交历史 |
| 日志 | `?tab=logs` | 运行实例的容器日志 |
| 计费 | `?tab=billing` | 资源使用与费用明细 |
| 设置 | `?tab=settings` | 别名、描述、可见性等 |

### 分析

展示运行实例的资源使用情况与访问趋势，用来判断空间是不是被卡在资源上。只有运行中的实例有数据。

### 日志

选择实例后展示该实例的**容器日志**，用来判断启动与运行是否正常。只有运行中的实例才有容器日志，未运行时页面会说明原因。

从「应用」页签的 **查看日志** 入口点进来，落点也是这个页签。

### 计费

按月份查看该空间的资源使用与费用明细，无数据时显示「暂无数据」。

### 设置

修改别名、描述与可见性等属性。空间的英文名与 SDK 类型创建后不可更改。

## 管理后台

管理员可在 **用户空间管理**（`/admin_panel/spaces`）搜索 Space 仓库，查看许可证、可见性与权重，进入详情设置权重或改可见性，并支持单条 / 批量删除。这里管理的是用户创建的应用仓库，与 **算力规格管理**（创建应用时可选的 CPU/GPU/NPU 规格）不是同一页。

## 相关操作

- [创建用户空间](./create_space)
- [下载用户空间](./download_space_repo)
- [管理后台说明](../admin/admin_intro)
