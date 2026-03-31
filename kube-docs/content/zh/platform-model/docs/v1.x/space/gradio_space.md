---
title: "Gradio 应用"
keywords: "行业大模型平台, Gradio, 应用空间, 机器学习演示, ML Demo"
description: "介绍如何创建和部署 Gradio 类型的应用空间，包括初始化代码和自动构建流程。"
linkTitle: "Gradio 应用"
weight: 4030
---

## 什么是 Gradio

[Gradio](https://gradio.app/) 是一个开源 Python 库，用于快速构建机器学习模型的交互式演示界面。只需几行代码，即可创建包含输入输出组件的 Web 应用，方便进行模型测试和展示。

## 创建 Gradio 应用空间

1. 按照 [创建应用空间](./create_space) 中的步骤，进入创建表单。
2. 在 **SDK 类型** 中选择 **Gradio**。
3. 如果选择了 GPU 算力资源，还需要选择 **驱动版本**（`11.8.0` 或 `12.1.0`）。
4. 填写其他必要参数后，点击 **创建应用空间** 提交。

## 初始化应用

创建完成后，需要向仓库推送应用代码来初始化 Gradio 空间。

### 第一步：克隆仓库

```bash
git clone https://<platform-host>/<namespace>/<space-name>
cd <space-name>
```

### 第二步：创建依赖文件

创建 `requirements.txt` 文件，指定 Gradio 版本及其他依赖：

```text
gradio==4.44.1
```

### 第三步：创建应用文件

创建 `app.py` 文件，编写 Gradio 应用代码。以下是一个简单的文本问答示例：

```python
import gradio as gr

def greet(name):
    return f"Hello, {name}! Welcome to the AI platform."

demo = gr.Interface(
    fn=greet,
    inputs=gr.Textbox(label="Your Name", placeholder="Enter your name..."),
    outputs=gr.Textbox(label="Greeting"),
    title="Hello World Demo",
    description="A simple Gradio application deployed on the platform."
)

demo.launch()
```

### 第四步：推送代码

```bash
git add requirements.txt app.py
git commit -m "Initialize Gradio application"
git push origin main
```

## 自动构建与部署

代码推送成功后，平台将自动触发构建和部署流程：

1. 安装 `requirements.txt` 中的依赖。
2. 启动 `app.py` 应用。
3. 构建完成后，应用空间页面将展示 Gradio 界面。

可在应用空间详情页查看构建日志和运行状态。

{{< notice note >}}
如果需要在 Gradio 应用中使用平台上的模型，可以通过平台提供的模型推理 API 进行调用。在 `app.py` 中，使用 `requests` 或 `openai` 等库请求模型推理端点即可。具体的 API 地址和认证方式请参考模型推理相关文档。
{{</ notice >}}

## 相关文档

- [创建应用空间](./create_space)
- [Streamlit 应用](./streamlit_space)
- [Docker 应用](./docker_space)
