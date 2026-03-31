---
title: "Create Space"
keywords: "Industry AI Model Platform, application space, create space, Gradio, Streamlit, Docker, MCP Server"
description: "How to create an application space on the platform, including form parameters, SDK type selection, and initialization steps."
linkTitle: "Create Space"
weight: 4020
---

## Entry Point

Click your avatar in the top-right corner and select **New Application Space** from the dropdown menu to open the creation form.

## Fill in the Form

The following parameters are required when creating an application space:

| Parameter | Required | Description |
|-----------|----------|-------------|
| Owner | Yes | Defaults to the current user; can be switched to an organization you belong to |
| Space English Name | Yes | 2–64 characters, must start with a letter, end with a letter or number, only `[a-zA-Z0-9-_.]` allowed, no consecutive `-`, `_`, or `.` |
| Nickname | No | Optional friendly name |
| License | Yes | Select an appropriate open-source license from the dropdown |
| Description | No | Brief description of the space purpose |
| Min Replica | Yes | `0`: auto-sleep when idle to save resources; `1`: keep the space always running |
| SDK Type | Yes | Select the application runtime framework, see details below |
| Docker Template | Docker only | Shown when Docker SDK is selected; choose from platform-provided templates |
| Cluster | Yes | Select the deployment compute cluster |
| Cloud Resource | Yes | Select the compute resource specification (CPU/GPU) based on the chosen cluster |
| Driver Version | GPU + Gradio/Streamlit only | Shown when GPU resource is selected with Gradio or Streamlit SDK; options: `11.8.0` or `12.1.0` |
| Environment Variables | No | Optional key-value pairs, supports plain variables and encrypted secrets |
| Visibility | Yes | **Public**: visible to all users; **Private**: visible only to you and organization members |

### SDK Types

| SDK Type | Description |
|----------|-------------|
| Gradio | For quickly building machine learning demo interfaces |
| Streamlit | For building data applications and dashboards |
| Docker | For deploying any containerized web application, with optional platform templates |
| Nginx | For deploying static websites (admin only) |
| MCP Server | For deploying MCP protocol services |

Click **Create Application Space** to submit.

## Initialize the Application

After creation, the platform redirects to the space detail page. You need to push application code corresponding to the selected SDK type to initialize the space:

- **Gradio**: push `requirements.txt` and `app.py` files
- **Streamlit**: push `app.py` file
- **Docker**: push a `Dockerfile` and related application code
- **MCP Server**: push MCP service configuration and code

{{< notice note >}}
Initialization steps vary by SDK type. Refer to the corresponding application type documentation for detailed instructions.
{{</ notice >}}

## Related Documentation

- [Gradio Applications](./gradio_space)
- [Streamlit Applications](./streamlit_space)
- [Docker Applications](./docker_space)
- [Download Space Repository](./download_space_repo)
