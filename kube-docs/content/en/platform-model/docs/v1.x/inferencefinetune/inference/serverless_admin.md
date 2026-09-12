---
title: "Manage Public Inference"
keywords: "Industry AI Model Platform, public inference, cloud API, model mapping, administrator"
description: "How platform administrators configure local public inference deployments and cloud API channels (vendor, key, model list, and mapping)."
linkTitle: "Manage Public Inference"
weight: 6235
---

## Admin Entry

Sign in as a platform administrator and open **Admin Console → Compute Resource → Public Inference**. The page has two tabs:

| Tab | Purpose |
|-----|---------|
| **Local deployments** | Manage shared inference already running in the cluster: details, edit, stop / restart, and logs |
| **Cloud API** | Register external vendor channels so cloud models appear in the user-facing public inference list |

The user-facing list merges both types when they are enabled.

## Local Deployments

Local public inference starts from a model repository, not from a “create” button on this list:

1. Open the target model and create a Serverless / public inference deployment as an administrator.
2. Fill in cluster, deploy name, ENV, min / max replicas, resource specification, and runtime framework.
3. After it is running, it appears on the **Local deployments** tab and in the user-facing **Public Inference** list.

## Cloud API Channels

On the **Cloud API** tab, click **New Cloud API** and fill in:

| Parameter | Description |
|-----------|-------------|
| **Name** | Display name of the channel |
| **Provider** | OpenAI, Azure, Aliyun DashScope, DeepSeek, Moonshot, Zhipu, SiliconFlow, VolcEngine, OpenRouter, or Custom |
| **Base URL** | Root URL of the upstream compatible API. Choosing a provider fills a common default |
| **API Key** | Sent as `Authorization: Bearer`; Azure uses `api-key`. Leave empty when editing to keep the existing key |
| **Model list** | Platform model IDs, added with Enter. Client requests and the public inference list use these IDs |
| **Model mapping** | Optional JSON object. Keys must already be in the model list; values are upstream IDs. IDs not listed are forwarded unchanged |
| **Enabled** | When off, the channel is hidden from the user list and the gateway |

Example: the platform ID is `kimi` and the upstream ID is `kimi-k3`. Put `kimi` in the model list and `{"kimi":"kimi-k3"}` in the mapping. Clients send `model=kimi`; the gateway forwards `kimi-k3`.

After saving, you can run a **connection test**. Only **enabled** channels appear in public inference and are forwarded through `/aigateway`.

{{< notice note >}}
Cloud channels are independent of platform model repositories. You do not need a matching repository first. The API key is stored only on the server and is not shown again in the form.
{{</ notice >}}

## Related Documentation

- [Public Inference Overview](./serverless_intro)
- [Use Public Inference](./serverless_usage)
- [Configure Inference Engines](./runtime_framework_admin)
- [Resource Specifications](/docs/v3.4/access-control-and-account-management/resource-specifications)
