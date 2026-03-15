---
title: "Create a Notebook Instance"
keywords: "Industry AI Model Platform, create Notebook, JupyterLab, VS Code, Eclipse Theia"
description: "How to create a Notebook instance on the Industry AI Model Platform, selecting the development environment and compute resources."
linkTitle: "Create a Notebook Instance"
weight: 6110
---

## Access Entry

There are two ways to navigate to the Notebook creation page:

- Click your profile avatar in the top right corner and select **New Notebook**.
- On a model details page, click **Use Model → Develop with Notebook**.

## Configuration Parameters

On the Notebook instance creation page, fill in the following configuration:

| Parameter | Description |
|-----------|-------------|
| **Instance Name** | Custom name; must not duplicate existing instances |
| **Pre-installed Image** | Select a pre-installed development environment image containing the required deep learning framework (e.g., PyTorch, TensorFlow) |
| **Runtime Framework** | Select the development environment type: JupyterLab, VS Code, or Eclipse Theia |
| **Region/Resource Config** | Select compute resource specifications (GPU model, VRAM size, CPU/memory configuration) |
| **Replica Count** | Select the elastic replica range for the instance |

After completing the configuration, click **Create Instance**.

## View Instance List

After creation, go to **Resource Console → Notebook Instance List** to view all created instances and their running status.

## Notes

{{< notice note >}}
- Notebook instances are billed by usage time. Stop instances when not in use to avoid unnecessary charges.
- Files in the working directory are retained after stopping an instance; data will be cleared when the instance is deleted — back up your work in advance.
{{</ notice >}}
