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
| **Region/Resource Config** | Select compute resource specifications for the inference service (GPU model, VRAM size) |
| **Runtime Framework** | Select the inference framework: vLLM, SGLang, TGI, or llama.cpp |
| **Security Level** | **Public**: accessible without authentication (default); **Private**: requires authentication |
| **Elastic Replicas** | Number of instance replicas, range 1–5 |

## View Instance List

After creation, go to **Resource Console → Dedicated Inference Instance List** to view all created instances and their running status.

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

- [FAQ](./endpoint_faq)
