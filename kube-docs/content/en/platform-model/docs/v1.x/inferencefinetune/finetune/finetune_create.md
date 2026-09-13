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
| **Region/Resource Config** | Select a GPU specification for the base model. The page shows **Recommended Minimum GPU Memory**; cards below that value are marked **Low Memory** |
| **Compute project** | The public tenant can only select **space**; an enterprise tenant lists projects you can use. Fine-tunes are private by default and have no public switch |
| **Runtime Framework** | Select the fine-tuning framework: **LLaMA-Factory** or **MS-Swift** |

## Recommended Minimum GPU Memory

The create page estimates the VRAM needed for fine-tuning and compares it with the **GPU Memory (GB)** advertised on each specification:

1. **Weight VRAM** ≈ parameter count (billions) × bytes per parameter (2 for BF16 / F16).
2. **Fine-tune recommendation** = weight VRAM × **2.0** (KV cache plus optimizer and runtime overhead). If the scanned LoRA estimate is larger, the larger value is used.
3. Specifications whose advertised VRAM is below the recommendation are marked **Low Memory**. You can still select them, but training is more likely to OOM.

Example: a ~27.78B BF16 model has about 55.56 GB of weights, so the fine-tune recommendation is about **111 GB**.

{{< notice note >}}
The recommendation is for SKU selection only. It is not used for GPU scheduling or vGPU slicing. Fine-tuning needs more headroom than inference; if training still OOMs, switch to a larger specification or enable quantized fine-tuning such as QLoRA.
{{</ notice >}}

## View Instance List

After creation, use the top navigation to open **Model Training & Evaluation → Fine-tuning Instances** to monitor instance startup progress and manage running fine-tuning tasks in real time. You can also view them centrally in **Resource Management**.

## Using the Fine-tuning Framework

Once the instance is running, click the instance name to enter the fine-tuning framework interface:

- **LLaMA-Factory**: Provides the visual LlamaBoard interface — select dataset, configure LoRA parameters, start training, and view real-time loss curves and other training metrics.
- **MS-Swift**: Provides both command-line and web interface options, supporting more model types and quantized fine-tuning options.

## Exporting the Fine-tuned Model

After training completes, merge and export the fine-tuned weights as a new independent model repository for subsequent inference deployment or evaluation.

## Related Documentation

- [Model Fine-tuning Overview](./finetune_intro)
- [FAQ](./finetune_faq)
