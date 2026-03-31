---
title: "Model Hub"
keywords: "Industry AI Model Platform, model hub, model management, upload model, download model"
description: "The Model Hub is where models are hosted for storage, management, discovery, and sharing."
linkTitle: "Model Hub"
weight: 1000
icon: "/images/docs/platform-model/model.svg"
---

## What is the Model Hub

The Model Hub is where models are hosted for storage, management, discovery, and sharing. Users can create their own Model Repositories, upload, download, and manage model files, and also explore, retrieve, and use other open models from the hub.

## Core Features

- **Model Upload & Management**: Upload model files via the Web interface, Git command line, or SDK, including large files (via Git LFS).
- **Version Control**: Manage model files with Git versioning, supporting history browsing and rollbacks.
- **Model Discovery**: Search and browse open models by tags, task type, framework, and other dimensions.
- **Access Control**: Supports public and private visibility settings; private models are accessible only to authorized users.
- **Model Deployment**: One-click deployment of models as dedicated inference instances, or launch fine-tuning jobs.

## Supported Model Formats

The platform is compatible with mainstream model formats, including:

- Hugging Face Transformers format (`config.json`, `pytorch_model.bin`, `.safetensors`, etc.)
- GGUF format (for llama.cpp)
- Other common model weight files

## Related Operations

- [Model Card](./model_card)
- [Create Model Repository](./create_model)
- [Upload Models](./upload_model)
- [Update Models](./update_model)
- [Download Models](./download_models)
