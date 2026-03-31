---
title: "Streamlit Applications"
keywords: "Industry AI Model Platform, Streamlit, application space, data application, data visualization"
description: "How to create and deploy a Streamlit application space, including initialization code and automatic build process."
linkTitle: "Streamlit Applications"
weight: 4040
---

## What is Streamlit

[Streamlit](https://streamlit.io/) is an open-source Python framework designed for building data applications and interactive dashboards. Without any frontend development experience, you can quickly create web applications with charts, tables, and interactive components using Python scripts.

## Create a Streamlit Space

1. Follow the steps in [Create Space](./create_space) to open the creation form.
2. Select **Streamlit** as the **SDK Type**.
3. If you selected a GPU compute resource, also choose a **Driver Version** (`11.8.0` or `12.1.0`).
4. Fill in the remaining parameters and click **Create Application Space** to submit.

## Initialize the Application

After creation, push application code to the repository to initialize the Streamlit space.

### Step 1: Clone the Repository

```bash
git clone https://<platform-host>/<namespace>/<space-name>
cd <space-name>
```

### Step 2: Create the Application File

Create an `app.py` file with your Streamlit application code. Here is a simple data display example:

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

If additional Python dependencies are needed, create a `requirements.txt` file:

```text
pandas
```

### Step 3: Push the Code

```bash
git add app.py
git commit -m "Initialize Streamlit application"
git push origin main
```

## Automatic Build and Deployment

After the code is pushed, the platform automatically triggers the build and deployment process:

1. Installs dependencies (if `requirements.txt` is present).
2. Starts the `app.py` application.
3. Once the build is complete, the space page displays the Streamlit interface.

You can view build logs and running status on the space detail page.

## Related Documentation

- [Create Space](./create_space)
- [Gradio Applications](./gradio_space)
- [Docker Applications](./docker_space)
