---
title: "Runtime Framework & Image Management"
keywords: "Kube AI Hub, runtime framework, inference engine, launch spec, KServe, llm-d"
description: "How platform administrators configure inference engine images, engine arguments, and KServe / llm-d launch settings."
linkTitle: "Runtime Framework & Image Management"
weight: 3220
---

Platform administrators maintain inference, fine-tuning, evaluation, Notebook, and job images in **Admin Console → Compute Resource → Runtime Framework & Image Management**. The list can be filtered by compute type and status. When KServe is enabled, the inference process command comes from **Launch (KServe / llm-d)** (`decode` / `prefill` / `routing`). `${GPU_NUM}` in engine args expands to the SKU per-replica card count.

Full procedures (tabs, Import Built-in, engine args, launch, and serving backends) are in the Industry AI Model Platform docs:

- [Configure Inference Engines](/platform-model/docs/v1.x/inferencefinetune/inference/runtime_framework_admin)
- [Create Dedicated Inference Instance](/platform-model/docs/v1.x/inferencefinetune/inference/endpoint_create)
- [Manage Public Inference](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_admin)
