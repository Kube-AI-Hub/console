---
title: "Model Evaluation FAQ"
keywords: "Industry AI Model Platform, model evaluation, FAQ"
description: "Frequently asked questions about model evaluation."
linkTitle: "Model Evaluation FAQ"
weight: 6410
---

## FAQ

### The evaluation button is grayed out with message "Framework does not support this model"

**Cause**: The current evaluation framework does not yet support this model.

**Solution**: Contact the platform administrator with the model name and relevant details. The administrator will evaluate and add support as soon as possible.

---

### Evaluation task is stuck in "Pending" state for a long time

**Cause**: Shared resources are selected and the public compute queue is busy.

**Solution**:
1. Wait for the queue to clear (shared resource evaluation tasks execute in submission order).
2. If immediate execution is needed, switch to **Dedicated Resources** (billed by time).

---

### Evaluation results appear abnormally low

**Possible Causes**:
- The selected evaluation dataset does not match the model's training language (e.g., using a Chinese dataset to evaluate an English model).
- The model lacks instruction-following capability for the corresponding task (base model vs. instruction-tuned model).
- Evaluation framework parameters are not configured appropriately.

**Solution**:
1. Choose evaluation datasets that match the model's language and task type.
2. For base models, use evaluation methods suitable for pre-trained models (e.g., perplexity evaluation).
3. Refer to [Evaluation Framework Overview](./evaluation_framework_intro) to understand each framework's applicable scenarios.

---

### How to use a custom dataset for evaluation

Refer to the [Custom Evaluation Datasets](./evaluation_with_custom_dataset) documentation for detailed steps.
