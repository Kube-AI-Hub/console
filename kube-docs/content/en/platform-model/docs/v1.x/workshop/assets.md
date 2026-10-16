---
title: "Capability Assets"
keywords: "Industry AI Model Platform, Agent Workshop, capability assets, skills, MCP, MCP tools, agent templates"
description: "The workshop's capability asset entries open the matching model platform lists in a new tab; the workshop references them instead of copying."
linkTitle: "Capability Assets"
weight: 4660
---

## Four entries

The **Capability assets** group in the workshop left menu offers four entries, all opening the model platform in a **new tab**:

| Item | Target page |
|------|-------------|
| Skills | The model platform skill list |
| MCP | The model platform MCP server list |
| MCP tools | The model platform MCP tool catalog |
| Agent templates | The model platform agent template list |

## Why nothing is copied

The **bodies** of skills, MCP servers, MCP tools, and agent templates stay in the model platform's Git repositories. The workshop stores only references, never a second copy of the repository.

The direct benefit: a capability is maintained once, upgrading it takes effect for every agent that references it, and two places can never drift apart.

## Visibility

The four entries use the same scope as the model library: **public repositories in the public tenant plus repositories in the current tenant**.

Whether a specific item can be viewed is decided by the model platform. An enterprise tenant can view public repositories of the public tenant; private repositories of the public tenant and repositories of other enterprises lead to an unauthorized page, and the workshop does not build a second authorization page.

## Using these assets in the workshop

- **Skills**: add them in the **Skills** section of a digital twin or service expert. The drawer groups them under "platform skills" and "built-in skills".
- **MCP servers and tools**: add them from the MCP category of the **Tools** drawer. Opening that category makes the platform read each server's tools in turn, so nothing has to be checked first; checking a server whose tools have not arrived yet reads them first and then selects the server together with all of its tools.
- **Agent templates**: delegate to an uploaded template with a **sub-agent** node on the workflow canvas, scoping its tools and knowledge.

## Related operations

- [Digital twin](./digital-twin)
- [Service expert](./service-expert)
- [MCP](/platform-model/docs/v1.x/mcp/)
