---
title: "Create Dedicated Inference Instance"
keywords: "Industry AI Model Platform, model inference, dedicated instance, deploy model"
description: "How to create a dedicated inference instance for a model on the Industry AI Model Platform."
linkTitle: "Create Dedicated Inference Instance"
weight: 6210
---

## Access Entry

On the model details page, click the **Deploy Model** button in the top right corner, then select **Dedicated Instance** from the dropdown menu to navigate to the creation page.

{{< notice note >}}
Only some models support creating dedicated instances. If the desired model does not have a "Dedicated Instance" option, contact the platform administrator.
{{</ notice >}}

## Configuration Parameters

On the dedicated instance creation page, fill in the following configuration, then click **Create Instance**:

| Parameter | Description |
|-----------|-------------|
| **Instance Name** | Custom name; must not duplicate existing instances |
| **Model ID** | The model identifier on the platform; defaults to the current model |
| **Min / Max Replicas** | Replica range. When the minimum is **0**, the instance shuts down automatically after 1 hour with no requests |
| **Region/Resource Config** | Select a compute specification. The page shows **Recommended Minimum GPU Memory**; cards below that value are marked **Low Memory**. A **multi-node** specification locks the replica count and cannot scale to 0 |
| **Compute project** | The instance lands in this project namespace and consumes its quota. The public tenant can only select **space**; an enterprise tenant lists projects you can use. See [Compute Projects and Visibility](../../tenancy/compute_and_visibility) |
| **Runtime Framework** | Choose the framework (vLLM, SGLang, TGI, or llama.cpp), then the framework version. Multi-node inference supports only vLLM and SGLang |
| **Engine Args** | Collapsed. Tunable options for the selected framework version (for example max generation length or dtype). Values that contain `${GPU_NUM}` expand to the SKU per-replica card count. Unchanged fields without that placeholder are not written into the launch command |
| **Quantization** | Shown when the model repository provides quantized files, such as GGUF or AWQ |
| **Security Level** | **Public**: project members see the portal entry; the inference API does not need an access token. **Private**: only the creator sees the portal entry; the API needs an access token that is not checked against the project |

## Recommended Minimum GPU Memory

The create page estimates the VRAM needed for inference and compares it with the **GPU Memory (GB)** advertised on each specification:

1. **Weight VRAM** ≈ parameter count (billions) × bytes per parameter (2 for BF16 / F16).
2. **Inference recommendation** = weight VRAM × **1.5** (KV cache). If the scanned “weights + KV + activation” estimate is larger, the larger value is used.
3. Specifications whose advertised VRAM is below the recommendation are marked **Low Memory**. You can still select them, but inference is more likely to OOM.

Example: a ~27.78B BF16 model has about 55.56 GB of weights, so the inference recommendation is about **83 GB**.

{{< notice note >}}
The recommendation is for SKU selection only. It is not used for GPU scheduling or vGPU slicing. Administrators must fill in the advertised GPU Memory (GB) with the usable VRAM of the whole card or slice.
{{</ notice >}}

## View Instance List

After creation, use the top navigation to open **Model Inference → Dedicated Instances** to view all created instances and their running status. You can also view them centrally in the dedicated instances section of **Resource Management**.

## Calling the Inference Service

Once the instance is running, the platform provides:

- **Web Testing Interface**: Test the model directly in your browser via conversation.
- **API Interface**: OpenAI-compatible API for business code integration.

For private instances, include an access token in the request header:

```bash
curl https://<instance-address>/v1/chat/completions \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<model-name>",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Related Documentation

- [Use Dedicated Inference Instance](./endpoint_usage)
- [Configure Inference Engines](./runtime_framework_admin)
- [FAQ](./endpoint_faq)
- [Compute Projects and Visibility](../../tenancy/compute_and_visibility)
