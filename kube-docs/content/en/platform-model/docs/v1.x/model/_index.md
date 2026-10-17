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
- **Model Discovery**: Search and browse models by tags, task type, framework, and source (including **This tenant**). The default list is other tenants' public repos ∪ the current tenant.
- **Access Control**: Supports public and private visibility settings; private models are accessible only to authorized users.
- **Model Deployment**: One-click deployment of models as dedicated inference instances, or launch fine-tuning jobs.

## Supported Model Formats

The platform is compatible with mainstream model formats, including:

- Hugging Face Transformers format (`config.json`, `pytorch_model.bin`, `.safetensors`, etc.)
- GGUF format (for llama.cpp)
- Other common model weight files

## Public Models

Besides the model repositories users create themselves, the platform has a class of **public models**: an administrator uploads the files into the `public/` directory of the shared model cache, and the platform scans that directory and shows them as `public/<name>`.

They differ from ordinary models in exactly three ways: the source is not Git, there is no version management, and they are read-only. Everything else matches an ordinary model: they can be searched and filtered in the list, browsed in the detail page, and selected and mounted by inference, fine-tuning, and evaluation.

Switch the source filter in the model library to **Public models** to see only this class. A public model's detail page has no branch, commit, new file, upload, edit, delete, or settings entries, and no **Download model** button.

## Related Operations

- [Model Card](./model_card)
- [Create Model Repository](./create_model)
- [Upload Models](./upload_model)
- [Update Models](./update_model)
- [Download Models](./download_models)
- [Admin console in detail](../admin/admin_intro)
- [Tenants and Compute Placement](../tenancy/)
