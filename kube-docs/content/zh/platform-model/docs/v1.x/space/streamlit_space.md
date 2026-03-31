---
title: "Streamlit 应用"
keywords: "行业大模型平台, Streamlit, 应用空间, 数据应用, 数据可视化"
description: "介绍如何创建和部署 Streamlit 类型的应用空间，包括初始化代码和自动构建流程。"
linkTitle: "Streamlit 应用"
weight: 4040
---

## 什么是 Streamlit

[Streamlit](https://streamlit.io/) 是一个开源 Python 框架，专为构建数据应用和交互式仪表板而设计。无需前端开发经验，即可通过 Python 脚本快速创建包含图表、表格和交互组件的 Web 应用。

## 创建 Streamlit 应用空间

1. 按照 [创建应用空间](./create_space) 中的步骤，进入创建表单。
2. 在 **SDK 类型** 中选择 **Streamlit**。
3. 如果选择了 GPU 算力资源，还需要选择 **驱动版本**（`11.8.0` 或 `12.1.0`）。
4. 填写其他必要参数后，点击 **创建应用空间** 提交。

## 初始化应用

创建完成后，需要向仓库推送应用代码来初始化 Streamlit 空间。

### 第一步：克隆仓库

```bash
git clone https://<platform-host>/<namespace>/<space-name>
cd <space-name>
```

### 第二步：创建应用文件

创建 `app.py` 文件，编写 Streamlit 应用代码。以下是一个简单的数据展示示例：

```python
import streamlit as st

st.set_page_config(page_title="AI Platform Demo", layout="wide")

st.title("Streamlit Demo Application")
st.write("This is a simple Streamlit application deployed on the platform.")

name = st.text_input("Enter your name:")
if name:
    st.success(f"Hello, {name}! Welcome to the AI platform.")

st.subheader("Sample Data")
import pandas as pd

data = pd.DataFrame({
    "Model": ["GPT-4", "LLaMA-3", "Qwen-2"],
    "Parameters": ["1.8T", "70B", "72B"],
    "Type": ["Closed", "Open", "Open"]
})
st.dataframe(data, use_container_width=True)

st.subheader("Interactive Chart")
chart_data = pd.DataFrame({
    "Category": ["Training", "Inference", "Fine-tuning"],
    "Hours": [120, 45, 80]
})
st.bar_chart(chart_data.set_index("Category"))
```

如果需要额外的 Python 依赖，创建 `requirements.txt` 文件：

```text
pandas
```

### 第三步：推送代码

```bash
git add app.py
git commit -m "Initialize Streamlit application"
git push origin main
```

## 自动构建与部署

代码推送成功后，平台将自动触发构建和部署流程：

1. 安装依赖（如有 `requirements.txt`）。
2. 启动 `app.py` 应用。
3. 构建完成后，应用空间页面将展示 Streamlit 界面。

可在应用空间详情页查看构建日志和运行状态。

## 相关文档

- [创建应用空间](./create_space)
- [Gradio 应用](./gradio_space)
- [Docker 应用](./docker_space)
