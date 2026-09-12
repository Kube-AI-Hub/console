---
title: "Model Inference FAQ"
keywords: "Industry AI Model Platform, model inference, FAQ"
description: "Frequently asked questions about dedicated model inference instances."
linkTitle: "Model Inference FAQ"
weight: 6220
---

## FAQ

### The deploy button is grayed out with message "Inference framework does not support this model"

**Cause**: The current inference framework does not yet support this model architecture.

**Solution**: Contact the platform administrator with the model name and relevant details. The administrator will evaluate and add support as soon as possible.

---

### The deploy button is grayed out with message "Model metadata not recognized"

**Cause**: The model files are incomplete, or the model's configuration information (architecture info in `config.json`) cannot be automatically recognized.

**Solution**:
1. Confirm the model repository contains a complete `config.json` file.
2. Contact the platform administrator to manually trigger a model metadata scan.

---

### Instance is stuck in "Starting" state for a long time

**Cause**: Compute resources may be tight, or the model image pull is taking a long time.

**Solution**:
1. Wait a while (large model image pulls may take several minutes).
2. If the instance has not started after 15 minutes, contact the platform administrator.

---

### How is Recommended Minimum GPU Memory calculated? Why does a specification show “Low Memory”?

**Details**: The create page estimates weight VRAM from parameter count and precision, then multiplies by **1.5** (KV cache). If the scanned “weights + KV + activation” estimate is larger, the larger value is used. That recommendation is compared with the **GPU Memory (GB)** advertised on each specification; cards below it are marked **Low Memory**.

The recommendation is for selection only and is not used for scheduling or vGPU slicing. You can still pick a Low Memory specification, but OOM is more likely.

---

### Recommended Minimum GPU Memory used to show 1 GB

**Cause**: Some models (for example the Qwen3.8 series) nest `hidden_size` under `text_config` in `config.json`. The old scanner read only top-level fields and then stored 1 GB as a fallback.

**Current behavior**: The page recalculates from parameter count and precision. A ~27.78B BF16 model has about 55.56 GB of weights, so the inference recommendation is about 83 GB. If stored metadata is still the old value, ask an administrator to rescan the model.

---

### What is the difference between public inference and a dedicated instance?

**Public inference** is provisioned by administrators. It includes shared local deployments and cloud API models, under **Model Inference → Public Inference**. Create a **dedicated instance** when you need exclusive compute, custom engine args, or quantization. See [Public Inference Overview](./serverless_intro).

---

### API call returns 401 Unauthorized

**Cause**: The instance security level is **Private** and the request does not include a valid access token.

**Solution**: Add an access token to the request header:

```bash
-H "Authorization: Bearer <access-token>"
```

Access tokens can be generated in **User Settings → Access Tokens**.

---

### Creation fails with `engine has no launch.decode`

**Cause**: The runtime framework has no **Launch (KServe / llm-d)** JSON, or it is missing `decode` (or the `template` alias). When KServe is enabled, inference must define how to start the process.

**Solution**: An administrator should edit the framework under **Admin Console → Compute Resource → Runtime Framework & Image Management** and add launch. See [Configure Inference Engines](./runtime_framework_admin).
