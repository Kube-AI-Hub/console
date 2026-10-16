---
title: "Agent Workshop"
keywords: "Industry AI Model Platform, Agent Workshop, digital twin, service expert"
description: "The Agent Workshop assembles models, tools, knowledge bases, and long-term memory into runnable, publishable, governable agents."
linkTitle: "Agent Workshop"
weight: 4500
icon: "/images/docs/platform-model/workshop.svg"
---

## What is the Agent Workshop

The Agent Workshop is the **agent building and operations** entry point on top of the Industry AI Model Platform. The model platform answers "where do models, data, and code live"; the workshop answers "how do we get a model to do work with tools, knowledge, and memory".

In the workshop, a builder picks a mode, configures the persona and capabilities, verifies the result in the chat pane on the right, and then publishes it for teammates in the same tenant or for a business system through the API. The whole path happens on one page: no YAML, and no need to understand containers or scheduling.

## Entry

Sign in to the Kube AI Hub console and pick **Agent Workshop** in the top product navigation to open `/studio-preview`.

The workshop is a separate page group: once inside, the console top bar is replaced by the workshop's own left menu, while the language and tenant switchers stay in the top right.

## Left menu

The workshop left menu has four groups:

| Group | Items | Description |
|-------|-------|-------------|
| Overview | Overview | Two entry cards: digital twin and service expert |
| My agents | Conversations & tasks | Only the agents the current user has talked to |
| My agents | My builds | Only the agents the current user created |
| Build & debug | All agents / Digital twin / Service expert | Agents visible in the current tenant, filtered by type |
| Capability assets | Skills / MCP / MCP tools / Agent templates | Opens the matching model platform list in a new tab |

## Three modes

Pick a mode when creating an agent; it cannot be changed afterwards. All three share one card, one publish flow, and one version mechanism:

| Mode | Runtime | Opens after creation | Best for |
|------|---------|----------------------|----------|
| Digital twin | Its own Hermes container | `/studio-preview/digital-twin/:namespace/:name` | Roles that need long-term memory, scheduled tasks, and autonomous execution |
| Service expert · Standard | Shared runtime, no container | `/studio-preview/expert/:id` | A job assistant that is ready once the persona and capabilities are set on one page |
| Service expert · Workflow | Shared runtime plus a flow canvas | `/studio-preview/orchestration/:id` | Business processes that need multi-step orchestration or multi-role collaboration |

All three support unified publishing, version management, and tenant isolation. For multi-agent collaboration, use the workflow mode: place a planning node plus sub-agent nodes on the canvas, and a sub-agent can delegate to an uploaded agent template.

## Relationship to the model platform

The workshop does not duplicate capability assets. The bodies of skills, MCP servers, MCP tools, and agent templates stay in the model platform's Git repositories, and the workshop only references them. A capability is maintained once, and upgrading it takes effect for every agent that references it.

Knowledge bases also come from the model platform, and the workshop searches them within the current tenant.

## Related operations

- [My agents](./agents)
- [Digital twin](./digital-twin)
- [Service expert](./service-expert)
- [Publishing](./publish)
- [Versions and restore](./versions)
- [Conversations and tasks](./conversations)
- [Knowledge base](./knowledge)
- [Capability assets](./assets)
- [Tenant and permissions](./tenancy)
