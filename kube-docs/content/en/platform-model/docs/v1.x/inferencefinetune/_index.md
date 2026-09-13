---
title: "Resource Management"
keywords: "Industry AI Model Platform, resource management, Notebook, inference, fine-tuning, evaluation"
description: "The Resource Management module provides development environments, dedicated inference instances, model fine-tuning, and model evaluation."
linkTitle: "Resource Management"
weight: 6000
icon: "/images/docs/platform-model/resource-mgmt.svg"
---

## Feature Overview

The Resource Management module provides compute support for the full LLM lifecycle. In the latest navigation, these capabilities are distributed across the `Model Inference`, `Model Training & Evaluation`, `Development Environment`, and `Resource Management` menus, covering four major capabilities:

| Feature | Description |
|---------|-------------|
| [Development Environment (Notebook Instances)](./notebook/notebook_intro) | One-click creation of interactive development environments; supports JupyterLab, VS Code, Eclipse Theia |
| [Model Inference](./inference/inference_intro) | Public inference (local deployments and cloud APIs) plus dedicated instances. Creating an instance selects a compute project; see [Compute Projects and Visibility](../tenancy/compute_and_visibility) |
| [Model Fine-tuning](./finetune/finetune_intro) | Customize base models using LLaMA-Factory or MS-Swift frameworks |
| [Model Evaluation](./evaluation/evaluation_create) | Benchmark testing with optional custom framework args, Prompt templates, and scoring plugins |
