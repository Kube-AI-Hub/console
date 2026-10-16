---
title: "Agent Templates"
keywords: "Industry AI Model Platform, agent templates, Agent Template, template reuse"
description: "An agent template repository stores a reusable agent definition in Git; a sub-agent node on the workflow canvas can delegate to an uploaded template."
linkTitle: "Agent Templates"
weight: 4900
icon: "/images/docs/platform-model/agents.svg"
---

## What is an agent template

An agent template repository stores a **reusable agent definition** in Git, with `AGENT.md` as the seed file.

The value of a template is turning a configured agent definition into a shareable asset: on the Agent Workshop's workflow canvas, a **sub-agent** node can delegate to an uploaded template and scope its tools and knowledge, which is how several roles collaborate on one business process.

## List

Go to **Data & Assets → Agent templates** (`/agents`).

- The top holds search and sorting, an **All / Mine** scope switch, and **+ New**.
- The left side filters by tag and the main area is a card grid; click a card for the detail page.

The scope matches the model library: **public repositories in the public tenant plus repositories in the current tenant**. The detail page uses the same scope as the list.

## Creating a template

The creation page takes the query parameter `type=agents`, and the form mirrors code repositories:

| Field | Description |
|-------|-------------|
| Owner | Defaults to the signed-in user; switchable when you belong to an organization |
| English name | Part of the repository path, cannot be changed after creation |
| Alias / description | Optional |
| Visibility | Public or private |
| Source URL | With a Git URL, mirroring is configured automatically |

## Detail

Opening `/agents/:namespace/:name` shows the README, metadata, and download statistics by default. The tabs are **Overview / card**, **Files**, and **Settings**, matching skill repositories.

## Using a template in an agent

On the service expert workflow canvas:

1. Add a **sub-agent** node from the **Base nodes** tab.
2. Pick an uploaded agent template in the inspector.
3. Scope the tools and knowledge this sub-agent may use.

A planning node splits the task and sub-agent nodes carry out their parts, forming multi-role collaboration.

## Admin console

Agent templates can be searched in the admin console's asset management, where visibility and weight are shown and one or many can be deleted.

## Related operations

- [Unified creation](../new_hub)
- [Agent Workshop / Capability assets](/platform-model/docs/v1.x/workshop/assets)
- [Agent Workshop / Service expert](/platform-model/docs/v1.x/workshop/service-expert)
- [Tenant and compute ownership](../tenancy/)
