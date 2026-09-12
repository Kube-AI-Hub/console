---
title: "Public Inference"
keywords: "Kube AI Hub, public inference, public models, cloud API"
description: "How platform administrators manage local public inference deployments and cloud API channels."
linkTitle: "Public Inference"
weight: 3210
---

Platform administrators manage two kinds of public models in **Admin Console → Compute Resource → Public Inference**: in-cluster local deployments, and cloud API channels that forward to external vendors.

Full procedures (tabs, channel fields, model mapping, connection test) are in the Industry AI Model Platform docs:

- [Manage Public Inference](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_admin)
- [Public Inference Overview](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_intro)
- [Use Public Inference](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_usage)

The user-facing entry is **Model Inference → Public Inference**. Cloud requests go through `/aigateway` on the console. The request `model` is the platform model ID registered on the channel. Launch settings for the runtime framework used by a local deployment are in [Runtime Framework & Image Management](./runtime-frameworks).
