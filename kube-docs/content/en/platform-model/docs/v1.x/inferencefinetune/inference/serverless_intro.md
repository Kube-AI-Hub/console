---
title: "Public Inference Overview"
keywords: "Industry AI Model Platform, public inference, public models, cloud API, serverless"
description: "Overview of public inference on the Industry AI Model Platform: local deployments and cloud API models, and how to discover and call them."
linkTitle: "Public Inference Overview"
weight: 6225
---

## What is Public Inference

**Public inference** is a shared entry point provisioned by administrators. Users do not create their own instance: open **Model Inference → Public Inference**, pick a model, chat in the Playground, or call the API.

The list shows two kinds of public models:

| Type | Access | Description |
|------|--------|-------------|
| **Local deployment** | In-cluster inference | An administrator deploys a platform repository as a shared service. The card shows the runtime framework and resource specification |
| **Cloud API** | Unified gateway | An administrator registers an external vendor channel (for example Moonshot, DeepSeek, or Alibaba DashScope). The card shows the vendor; it does not consume cluster GPUs |

Both types expose an OpenAI-compatible API. Cloud models are forwarded through `/aigateway` (or `/platform-model/aigateway`) on the console. The request `model` field is the platform model ID.

## Compared with Dedicated Instances

| | Public inference | Dedicated instance |
|--|------------------|--------------------|
| **Who creates it** | Platform administrator | Regular user |
| **Compute** | Shared local deployment, or the cloud vendor’s compute | Exclusive specification chosen by the user |
| **Entry** | **Model Inference → Public Inference** | **Model Inference → Dedicated Instances**, or Deploy on the model detail page |
| **Auth** | Cloud channels always require an access token; local deployments follow the public / private setting | Chosen when the instance is created |

Use a [dedicated instance](./endpoint_create) when you need exclusive resources, custom engine args, or a specific quantization.

## Related Documentation

- [Use Public Inference](./serverless_usage)
- [Manage Public Inference](./serverless_admin)
- [Model Inference Overview](./inference_intro)
