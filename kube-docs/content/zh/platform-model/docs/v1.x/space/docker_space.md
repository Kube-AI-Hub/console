---
title: "Docker 应用"
keywords: "行业大模型平台, Docker, 应用空间, 容器化部署, ChatUI, Dockerfile"
description: "介绍如何创建和部署 Docker 类型的应用空间，包括模板选择、自定义 Dockerfile 和自动构建流程。"
linkTitle: "Docker 应用"
weight: 4050
---

## 什么是 Docker 应用空间

Docker 应用空间允许用户部署任意容器化 Web 应用。相比 Gradio 和 Streamlit 提供的预设运行环境，Docker 类型提供了更大的灵活性，支持任何编程语言和框架，适用于需要自定义运行环境的场景。

## 创建 Docker 应用空间

1. 按照 [创建应用空间](./create_space) 中的步骤，进入创建表单。
2. 在 **SDK 类型** 中选择 **Docker**。
3. 在 **Docker 模板** 中选择一个平台预置模板（如 ChatUI）或后续使用自定义 Dockerfile。
4. 填写其他必要参数后，点击 **创建应用空间** 提交。

## 使用 ChatUI 模板

ChatUI 是常用的 Docker 模板之一，可以快速部署一个对话式 AI 界面。

### 配置步骤

1. 创建空间时，选择 **Docker** SDK 类型和 **ChatUI** 模板。
2. 模板会自动显示需要填写的变量和密钥字段。
3. 在 **Space Variables** 中填入目标模型的名称，该模型需已在平台上部署推理服务。
4. 根据模板提示填写其他必要的配置信息。
5. 完成创建后，空间将自动使用 ChatUI 模板初始化并部署。

{{< notice note >}}
使用 ChatUI 模板时，所引用的模型需已启动推理实例。请先在模型页面创建推理服务，获取模型名称后再配置 ChatUI 空间。
{{</ notice >}}

## 使用自定义 Dockerfile

如果平台预置模板不满足需求，可以使用自定义 Dockerfile 部署应用。

### 第一步：克隆仓库

```bash
git clone https://<platform-host>/<namespace>/<space-name>
cd <space-name>
```

### 第二步：创建 Dockerfile

创建 `Dockerfile`，定义应用的构建和运行环境。以下是一个基于 Python Flask 的示例：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["python", "app.py"]
```

### 第三步：创建应用代码

创建 `requirements.txt`：

```text
flask==3.0.0
```

创建 `app.py`：

```python
from flask import Flask, render_template_string

app = Flask(__name__)

@app.route("/")
def index():
    return render_template_string("""
    <html>
    <head><title>Docker Space Demo</title></head>
    <body>
        <h1>Hello from Docker Space!</h1>
        <p>This application is running in a Docker container on the platform.</p>
    </body>
    </html>
    """)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860)
```

### 第四步：推送代码

```bash
git add Dockerfile requirements.txt app.py
git commit -m "Initialize Docker application"
git push origin main
```

## 自动构建与部署

代码推送成功后，平台将自动触发构建和部署流程：

1. 根据 `Dockerfile` 构建容器镜像。
2. 部署并启动容器。
3. 构建完成后，应用空间页面将展示应用界面。

可在应用空间详情页查看构建日志和运行状态。

{{< notice note >}}
Docker 应用需要监听 `7860` 端口，平台会将该端口映射为应用的访问入口。请确保应用启动后在该端口提供 HTTP 服务。
{{</ notice >}}

## 相关文档

- [创建应用空间](./create_space)
- [Gradio 应用](./gradio_space)
- [Streamlit 应用](./streamlit_space)
