---
title: "Spaces"
keywords: "Industry AI Model Platform, Spaces, Gradio, Streamlit, AI applications"
description: "Spaces is a platform for showcasing large model applications, where developers can build and display various AI applications."
linkTitle: "Spaces"
weight: 4000
icon: "/images/docs/platform-model/space.svg"
---

## What are Spaces

Spaces is a platform for showcasing large model applications. Developers can build and display various AI applications in Spaces, including multi-model combinations, interactive visualizations, and more, providing a capability showcase platform for developers.

## Supported Application Types

| Type | Description |
|------|-------------|
| Gradio | Interactive ML demo apps built with the Gradio framework |
| Streamlit | Data applications built with the Streamlit framework |
| Docker | Any web application deployed with a custom Docker image |
| Nginx | Static website hosting |
| MCP App | Tool services based on the Model Context Protocol |

## Core Features

- **Interactivity**: Provides a web interface for users to interact with models.
- **Easy Deployment**: Users just upload code; the platform handles building, deploying, and hosting.
- **Privacy Control**: Supports public or private settings, suitable for enterprise or personal use.
- **Version Management**: Application code is Git-managed, supporting version rollbacks.

## Quick Start (Gradio)

1. Create a new Space on the platform, choosing the **Gradio** type.
2. Clone the Space repository to your local machine:
   ```bash
   git clone https://<platform-host>/<namespace>/<space-name>
   ```
3. Create an `app.py` file:
   ```python
   import gradio as gr

   def greet(name):
       return f"Hello, {name}!"

   demo = gr.Interface(fn=greet, inputs="text", outputs="text")
   demo.launch()
   ```
4. Commit and push the code; the platform will automatically build and deploy:
   ```bash
   git add app.py
   git commit -m "Add Gradio app"
   git push
   ```

## Quick Start (Streamlit)

1. Create a new Space on the platform, choosing the **Streamlit** type.
2. Clone and create an `app.py` file:
   ```python
   import streamlit as st

   st.title("My AI App")
   user_input = st.text_input("Enter text")
   if user_input:
       st.write(f"You entered: {user_input}")
   ```
3. Commit and push the code; the platform will automatically deploy.

## Detail tabs

Opening a space detail page (`/spaces/:namespace/:name`) reveals these tabs:

| Tab | Path | Contents |
|-----|------|----------|
| Application | default | Run state, access address, build log entry |
| Analysis | `?tab=analysis` | Resource usage and access trends for the instance |
| Files | `?tab=files` | Browse, upload, and create files; view commit history |
| Logs | `?tab=logs` | Container logs of the running instance |
| Billing | `?tab=billing` | Resource usage and cost breakdown |
| Settings | `?tab=settings` | Alias, description, visibility, and more |

### Analysis

Shows resource usage and access trends for the running instance, to tell whether the space is starved of resources. Only a running instance has data.

### Logs

Pick an instance to see its **container logs**, to tell whether startup and operation are healthy. Only a running instance has container logs; the page explains why when it is not running.

Reaching this tab through **View logs** on the Application tab lands in the same place.

### Billing

Shows the space's resource usage and cost breakdown by month, with "No data" when there is nothing.

### Settings

Change the alias, description, and visibility. The space's English name and SDK type cannot be changed after creation.

## Related Operations

- [Create a user space](./create_space)
- [Download Spaces](./download_space_repo)
- [Admin console in detail](../admin/admin_intro)
