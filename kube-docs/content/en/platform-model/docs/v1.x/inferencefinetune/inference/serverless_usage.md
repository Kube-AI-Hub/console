---
title: "Use Public Inference"
keywords: "Industry AI Model Platform, public inference, Playground, cloud model, thinking mode, API"
description: "How to test and call local deployments and cloud API models from public inference."
linkTitle: "Use Public Inference"
weight: 6230
---

## Open a Public Model

1. Open **Model Inference → Public Inference**.
2. Each card shows the model ID, access type (framework and specification for local, vendor for cloud), and status.
3. Click a card for details. Cloud models show the **Inference API URL**, **provider**, and access mode **Cloud**. Local deployments show the replica range and resource specification.
4. Cloud models do not link to a platform repository.

## Playground Testing

When the service is **Running**, the detail page provides a conversation test:

1. Enter a prompt and adjust Temperature, Top-P, or Max Tokens as needed. OpenAI-compatible cloud channels usually accept **Max Tokens** only; other sampling fields are fixed upstream.
2. Use the **Thinking mode** switch:
   - **Local deployment**: when off, the request sends `chat_template_kwargs.enable_thinking=false`.
   - **Cloud API**: the request sends `reasoning_effort` as `high` (on) or `low` (off). Some cloud models (for example Kimi K3) cannot fully disable thinking; `low` only reduces thinking effort.
3. Replies that include reasoning show the thinking block separately.

## API Calls

Switch to the **API** tab on the detail page for the current service URL and examples.

### Local deployment

The URL is the shared instance endpoint. Usage matches the [dedicated instance API](./endpoint_usage). Private services require an access token.

### Cloud API

Cloud models go through the console gateway. The request `model` must be the **platform model ID** registered on the channel (it may differ from the upstream ID):

```bash
curl https://<console-host>/aigateway/v1/chat/completions \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<platform-model-id>",
    "messages": [{"role": "user", "content": "Hello"}],
    "reasoning_effort": "high"
  }'
```

Some deployments use `/platform-model/aigateway/v1/chat/completions`. Use the **Inference API URL** shown on the detail page.

{{< notice note >}}
Cloud channels always require an access token. Generate one in **User Settings → Access Tokens**. The gateway rewrites the platform ID to the upstream ID using the administrator’s **model mapping**. Callers do not need to know the upstream name.
{{</ notice >}}

## Monitoring and Request Logs

A **shared local deployment** in Public Inference uses the same observability as a dedicated instance. See [Use Dedicated Inference Instance](./endpoint_usage):

- **Analysis** tab: resource and traffic metrics, plus LLM serving SLA charts for TTFT, output rate, token volumes, cached tokens and cache hit rate;
- **Logs** tab: container logs and **request logs** - one row per call, with TTFT, input/output tokens, **cached tokens** and output rate, filterable by time range and user.

Cloud API models are served by upstream providers and do not offer these engine-level metrics or request logs.

{{< notice note >}}
**Cached tokens in the request log are always 0?** The prefix cache matches in blocks, so a prompt shorter than one block (measured at **544** tokens on this platform) can never hit. That 0 is expected, not a collection failure. See [Model Inference FAQ](./endpoint_faq) for how to tell and reproduce.
{{</ notice >}}

## Related Documentation

- [Public Inference Overview](./serverless_intro)
- [Manage Public Inference](./serverless_admin)
- [Use Dedicated Inference Instance](./endpoint_usage)
