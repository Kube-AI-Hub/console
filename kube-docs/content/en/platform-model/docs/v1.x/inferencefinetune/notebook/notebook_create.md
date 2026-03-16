---
title: "Create a Development Instance"
keywords: "Industry AI Model Platform, create Notebook, JupyterLab, VS Code, Eclipse Theia"
description: "How to create a development instance on the Industry AI Model Platform, selecting the development environment and compute resources."
linkTitle: "Create a Development Instance"
weight: 6110
---

## Access Entry

There are two main ways to navigate to the development instance creation page:

- Click your profile avatar in the top right corner and select **New Development Instance**.
- Open the **Development Environment** page from the top navigation, then click **New Development Instance**.
- On a model details page, click **Use Model → Develop with Notebook**.

## Configuration Parameters

On the development instance creation page, fill in the following configuration:

| Parameter | Description |
|-----------|-------------|
| **Instance Name** | Custom name; must not duplicate existing instances |
| **Pre-installed Image** | Select a pre-installed development environment image containing the required deep learning framework (e.g., PyTorch, TensorFlow) |
| **Runtime Framework** | Select the development environment type: JupyterLab, VS Code, or Eclipse Theia |
| **Region/Resource Config** | Select compute resource specifications (GPU model, VRAM size, CPU/memory configuration) |
| **Replica Count** | Select the elastic replica range for the instance |

After completing the configuration, click **Create Instance**.

## View Instance List

After creation, go to the **Development Environment** page to view all created instances and their running status. You can also view them centrally under the **Notebook** section in **Resource Management**.

## Notes

{{< notice note >}}
- Development instances are billed by usage time. Stop instances when not in use to avoid unnecessary charges.
- Files in the working directory are retained after stopping an instance; data will be cleared when the instance is deleted — back up your work in advance.
{{</ notice >}}
