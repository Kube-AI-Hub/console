---
title: "Model Fine-tuning FAQ"
keywords: "Industry AI Model Platform, model fine-tuning, FAQ"
description: "Frequently asked questions about model fine-tuning."
linkTitle: "Model Fine-tuning FAQ"
weight: 6320
---

## FAQ

### The fine-tune button is grayed out with message "Fine-tuning framework does not support this model"

**Cause**: The current fine-tuning framework (LLaMA-Factory or MS-Swift) does not yet support this model architecture.

**Solution**: Contact the platform administrator with the model name and relevant details. The administrator will evaluate and add support as soon as possible.

---

### The fine-tune button is grayed out with message "Model metadata not recognized"

**Cause**: The model files are incomplete, or the model's configuration information (architecture info in `config.json`) cannot be automatically recognized.

**Solution**:
1. Confirm the model repository contains a complete `config.json` file.
2. Contact the platform administrator to manually trigger a model metadata scan.

---

### Training loss is not decreasing

**Possible Causes**:
- Learning rate is too high or too low.
- Dataset format is incorrect, causing samples to be skipped.
- Training data volume is too small.

**Solution**:
1. Check that the dataset format matches the selected framework's requirements.
2. Adjust the learning rate (starting from `1e-4` is recommended).
3. Ensure sufficient training samples (at least a few hundred is recommended).

---

### How is Recommended Minimum GPU Memory calculated? Why does a specification show “Low Memory”?

**Details**: The create page estimates weight VRAM from parameter count and precision, then multiplies by **2.0** (KV cache plus optimizer and runtime overhead). If the scanned LoRA estimate is larger, the larger value is used. That recommendation is compared with the **GPU Memory (GB)** advertised on each specification; cards below it are marked **Low Memory**.

Fine-tuning needs more headroom than inference. A ~27.78B BF16 model has about 55.56 GB of weights, so the fine-tune recommendation is about 111 GB (about 83 GB for inference).

Older metadata for some models may still store 1 GB (the scanner missed nested `text_config`). The page now recalculates from parameter count; an administrator can also rescan the model.

---

### Out of memory (OOM) during training

**Solution**:
1. Prefer a specification at or above **Recommended Minimum GPU Memory**. Cards marked **Low Memory** are more likely to OOM.
2. Switch to a compute configuration with more VRAM.
3. Enable quantized fine-tuning in the framework settings (e.g., QLoRA with 4-bit quantization).
4. Reduce the batch size.
5. Use gradient accumulation to achieve an equivalent larger batch size.
