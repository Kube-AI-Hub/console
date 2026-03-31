---
title: "Docker Applications"
keywords: "Industry AI Model Platform, Docker, application space, containerized deployment, ChatUI, Dockerfile"
description: "How to create and deploy a Docker application space, including template selection, custom Dockerfile, and automatic build process."
linkTitle: "Docker Applications"
weight: 4050
---

## What is a Docker Space

A Docker application space allows you to deploy any containerized web application. Compared to Gradio and Streamlit which provide preset runtime environments, Docker offers greater flexibility, supporting any programming language and framework for scenarios requiring custom runtime environments.

## Create a Docker Space

1. Follow the steps in [Create Space](./create_space) to open the creation form.
2. Select **Docker** as the **SDK Type**.
3. Choose a platform-provided template (e.g., ChatUI) under **Docker Template**, or use a custom Dockerfile later.
4. Fill in the remaining parameters and click **Create Application Space** to submit.

## Using the ChatUI Template

ChatUI is one of the commonly used Docker templates for quickly deploying a conversational AI interface.

### Configuration Steps

1. When creating the space, select the **Docker** SDK type and the **ChatUI** template.
2. The template automatically displays variable and secret fields that need to be filled in.
3. In **Space Variables**, enter the name of the target model that already has an inference service deployed on the platform.
4. Fill in any other required configuration fields prompted by the template.
5. After creation, the space will automatically initialize and deploy using the ChatUI template.

{{< notice note >}}
When using the ChatUI template, the referenced model must have an active inference instance. Create an inference service on the model page first, then configure the ChatUI space with the model name.
{{</ notice >}}

## Using a Custom Dockerfile

If the platform templates do not meet your needs, you can deploy an application with a custom Dockerfile.

### Step 1: Clone the Repository

```bash
git clone https://<platform-host>/<namespace>/<space-name>
cd <space-name>
```

### Step 2: Create a Dockerfile

Create a `Dockerfile` defining the build and runtime environment. Here is a Python Flask example:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["python", "app.py"]
```

### Step 3: Create Application Code

Create `requirements.txt`:

```text
flask==3.0.0
```

Create `app.py`:

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

### Step 4: Push the Code

```bash
git add Dockerfile requirements.txt app.py
git commit -m "Initialize Docker application"
git push origin main
```

## Automatic Build and Deployment

After the code is pushed, the platform automatically triggers the build and deployment process:

1. Builds the container image based on the `Dockerfile`.
2. Deploys and starts the container.
3. Once the build is complete, the space page displays the application interface.

You can view build logs and running status on the space detail page.

{{< notice note >}}
Docker applications must listen on port `7860`. The platform maps this port as the application's access entry point. Ensure your application serves HTTP on this port after startup.
{{</ notice >}}

## Related Documentation

- [Create Space](./create_space)
- [Gradio Applications](./gradio_space)
- [Streamlit Applications](./streamlit_space)
