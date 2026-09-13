---
title: "Compute Projects and Visibility"
keywords: "Industry AI Model Platform, compute project, quota, public inference, access token"
description: "Pick a compute project when you create an instance. Who sees the portal entry is separate from whether the inference API requires an access token."
linkTitle: "Compute Projects and Visibility"
weight: 530
---

## Compute project

Create forms for dedicated inference, fine-tuning, notebooks, evaluation, and Spaces include **Compute project**, next to region and SKU.

| Current tenant | What the dropdown contains |
|----------------|----------------------------|
| Public tenant | Only **space** (namespace `spaces`) |
| Enterprise tenant | Projects (Kubernetes namespaces) you can use |

The instance lands in that project namespace and consumes that namespace's ResourceQuota. Instances attach to a project, not to an organization.

Admin **compute resource overview** sums quota and usage for those projects in the current tenant. It is **not** remaining cluster-node inventory. Do not read the overview as "how many cores the cluster still has". Specification tables and runtime frameworks stay a shared platform catalog.

{{< notice note >}}
Notebooks and fine-tunes have no public / private control; they default to private. Ordinary project members cannot open someone else's IDE.
{{</ notice >}}

## Portal visibility vs inference API

Treat the two meanings of "public" separately:

| | Portal list | Inference API (`/endpoint`) |
|--|-------------|------------------------------|
| **Public** | Members of the compute project see the entry | No access token; anonymous calls work |
| **Private** | Only the creator sees it; project admins can stop or delete to reclaim quota | A valid access token is required; the token is not checked against the project |

A user who is not in the project will not see the entry in the portal, even if they guess the URL. A public inference URL can still be called from outside. "Hidden in the portal" is not "anonymous API blocked".

Calling a private instance still sends an access token. See [Using Dedicated Inference Instances](../inferencefinetune/inference/endpoint_usage).

## Related documentation

- [Create Dedicated Inference Instance](../inferencefinetune/inference/endpoint_create)
- [Create a Fine-tuning Instance](../inferencefinetune/finetune/finetune_create)
- [Create a Development Instance](../inferencefinetune/notebook/notebook_create)
- [Public Inference](/docs/v3.4/access-control-and-account-management/public-inference/)
