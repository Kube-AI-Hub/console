---
title: "应用空间"
keywords: "行业大模型平台, 应用空间, Space, Gradio, Streamlit, AI应用"
description: "应用空间（Space）是大模型应用的展示平台，开发者可以在应用空间中自行搭建和展示不同的AI应用。"
linkTitle: "应用空间"
weight: 4000
icon: "/images/docs/platform-model/space.svg"
---

## 什么是应用空间

应用空间（Space）是大模型应用的展示平台，开发者可以在应用空间中自行搭建和展示不同的 AI 应用，包括多种模型组合、可视化的交互展现形式等，为开发者提供一个能力展示平台。

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

1. 在平台创建一个新的应用空间，选择 **Gradio** 类型。
2. 克隆应用空间仓库到本地：
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

1. 在平台创建一个新的应用空间，选择 **Streamlit** 类型。
2. 克隆并创建 `app.py` 文件：
   ```python
   import streamlit as st

   st.title("我的 AI 应用")
   user_input = st.text_input("输入文本")
   if user_input:
       st.write(f"您输入了：{user_input}")
   ```
3. 提交并推送代码，平台自动部署。

## 相关操作

- [下载应用空间](./download_space_repo)
