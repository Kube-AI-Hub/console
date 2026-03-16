---
title: "Development Environment (Notebook Instances) Overview"
keywords: "Industry AI Model Platform, Notebook, JupyterLab, VS Code, Eclipse Theia, interactive development"
description: "The Development Environment provides one-click interactive development instances, allowing users to use platform compute resources directly for data analysis, model training, and experimentation."
linkTitle: "Development Environment Overview"
weight: 6100
---

## What is the Development Environment

The Development Environment page centralizes the creation and management of Notebook-style instances. Users can directly use platform compute resources for data analysis, model training, and experimentation with no environment setup required. Instances are ready to use immediately, supporting rapid iteration and interactive development.

## Supported Development Environments

The platform provides three interactive development environments:

| Environment | Description |
|-------------|-------------|
| **JupyterLab** | Feature-rich interactive notebook environment supporting Python, R, and more; ideal for data analysis and model experimentation |
| **VS Code** | Browser-based Visual Studio Code providing a full IDE experience; ideal for code development and debugging |
| **Eclipse Theia** | Open-source cloud IDE providing a VS Code-like development experience; ideal for team collaborative development |

## Core Features

- **Ready to Use**: No manual configuration of Python environments, CUDA drivers, or deep learning frameworks needed — just select a pre-installed image.
- **Elastic Compute**: Select GPU/CPU resource configurations on demand; stop when done to save compute costs.
- **Dataset Integration**: Access platform model and dataset repositories directly from within the Notebook.
- **Persistent Storage**: The development instance working directory is persisted; data is not lost when the instance is stopped.

## Workflow

```
Open the Development Environment page
         ↓
Click "New Development Instance"
         ↓
Select development environment (JupyterLab / VS Code / Eclipse Theia)
         ↓
Select pre-installed image and compute configuration
         ↓
Open development environment in browser after instance starts
         ↓
Stop or delete instance when development is complete
```

## Related Documentation

- [Create a Development Instance](./notebook_create)
