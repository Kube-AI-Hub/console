---
title: "Create a Fine-tuning Instance"
keywords: "Industry AI Model Platform, create fine-tuning instance, LLaMA-Factory, MS-Swift"
description: "How to create a fine-tuning instance for a model on the Industry AI Model Platform."
linkTitle: "Create a Fine-tuning Instance"
weight: 6310
---

## Access Entry

On the **base model** details page you want to fine-tune, click the **Fine-tune Instance** button in the top right corner to navigate to the creation page.

{{< notice tip >}}
If the "Fine-tune Instance" button is not shown on the model details page, the model does not currently support this feature. Contact the platform administrator for more information.
{{</ notice >}}

## Configuration Parameters

On the fine-tuning instance creation page, fill in the following configuration, then click **Create Instance**:

| Parameter | Description |
|-----------|-------------|
| **Instance Name** | Custom name; must not duplicate existing instances (e.g., `qwen-medical-finetune`) |
| **Model ID** | The model identifier on the platform; defaults to the currently selected base model |
| **Region/Resource Config** | Select GPU resources appropriate for the base model size (VRAM must accommodate the model and training gradients) |
| **Runtime Framework** | Select the fine-tuning framework: **LLaMA-Factory** or **MS-Swift** |

## View Instance List

After creation, go to **Resource Console → Fine-tuning Instance List** to monitor instance startup progress and manage running fine-tuning tasks in real time.

## Using the Fine-tuning Framework

Once the instance is running, click the instance name to enter the fine-tuning framework interface:

- **LLaMA-Factory**: Provides the visual LlamaBoard interface — select dataset, configure LoRA parameters, start training, and view real-time loss curves and other training metrics.
- **MS-Swift**: Provides both command-line and web interface options, supporting more model types and quantized fine-tuning options.

## Exporting the Fine-tuned Model

After training completes, merge and export the fine-tuned weights as a new independent model repository for subsequent inference deployment or evaluation.

## Related Documentation

- [Model Fine-tuning Overview](./finetune_intro)
- [FAQ](./finetune_faq)
