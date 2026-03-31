---
title: "Gradio Applications"
keywords: "Industry AI Model Platform, Gradio, application space, machine learning demo, ML demo"
description: "How to create and deploy a Gradio application space, including initialization code and automatic build process."
linkTitle: "Gradio Applications"
weight: 4030
---

## What is Gradio

[Gradio](https://gradio.app/) is an open-source Python library for quickly building interactive demo interfaces for machine learning models. With just a few lines of code, you can create a web application with input and output components for model testing and demonstration.

## Create a Gradio Space

1. Follow the steps in [Create Space](./create_space) to open the creation form.
2. Select **Gradio** as the **SDK Type**.
3. If you selected a GPU compute resource, also choose a **Driver Version** (`11.8.0` or `12.1.0`).
4. Fill in the remaining parameters and click **Create Application Space** to submit.

## Initialize the Application

After creation, push application code to the repository to initialize the Gradio space.

### Step 1: Clone the Repository

```bash
git clone https://<platform-host>/<namespace>/<space-name>
cd <space-name>
```

### Step 2: Create the Dependencies File

Create a `requirements.txt` file specifying the Gradio version and other dependencies:

```text
gradio==4.44.1
```

### Step 3: Create the Application File

Create an `app.py` file with your Gradio application code. Here is a simple text greeting example:

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

### Step 4: Push the Code

```bash
git add requirements.txt app.py
git commit -m "Initialize Gradio application"
git push origin main
```

## Automatic Build and Deployment

After the code is pushed, the platform automatically triggers the build and deployment process:

1. Installs dependencies from `requirements.txt`.
2. Starts the `app.py` application.
3. Once the build is complete, the space page displays the Gradio interface.

You can view build logs and running status on the space detail page.

{{< notice note >}}
To use models from the platform within your Gradio application, you can call the platform's model inference API. In `app.py`, use libraries such as `requests` or `openai` to send requests to the model inference endpoint. Refer to the model inference documentation for API addresses and authentication details.
{{</ notice >}}

## Related Documentation

- [Create Space](./create_space)
- [Streamlit Applications](./streamlit_space)
- [Docker Applications](./docker_space)
