---
title: "Model Fine-tuning Overview"
keywords: "Industry AI Model Platform, model fine-tuning, LLaMA-Factory, MS-Swift, one-click fine-tuning"
description: "The platform provides GPU-accelerated fine-tuning instance hosting, supporting LLaMA-Factory and MS-Swift frameworks."
linkTitle: "Model Fine-tuning Overview"
weight: 6300
---

## What is Model Fine-tuning

The platform provides GPU-accelerated fine-tuning instance hosting services, supporting mainstream fine-tuning frameworks (`LLaMA-Factory`, `MS-Swift`). Users only need to select compute resources and a dataset to quickly perform customized training on large models — no complex training code required.

## Supported Fine-tuning Frameworks

| Framework | Features |
|-----------|----------|
| **LLaMA-Factory** | Provides a visual web training UI (LlamaBoard); supports multiple fine-tuning methods (LoRA, QLoRA, full-parameter fine-tuning, etc.); easy to get started |
| **MS-Swift** | From ModelScope community; supports a wide range of domestic and international mainstream models; provides rich fine-tuning algorithms and quantization options |

## Core Features

- **One-Click Launch**: Click the fine-tuning button on the model details page to automatically allocate compute and mount the model environment.
- **Full Lifecycle Management**: Covers fine-tuning creation, training metric monitoring, and model export.
- **Visual Framework UI**: LLaMA-Factory includes a visual training panel — configure training parameters without the command line.
- **Flexible Compute**: Select different GPU resource specifications on demand.
- **Model Export**: After fine-tuning, export the trained weights as an independent model repository.

## Fine-tuning Workflow

```
Select base model → Create fine-tuning instance → Configure dataset and training parameters → Start training → Monitor training metrics → Export fine-tuned model
```

## Related Documentation

- [Create a Fine-tuning Instance](./finetune_create)
- [FAQ](./finetune_faq)
