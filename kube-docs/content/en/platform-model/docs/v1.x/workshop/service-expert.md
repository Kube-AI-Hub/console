---
title: "Service Expert"
keywords: "Industry AI Model Platform, Agent Workshop, service expert, standard mode, workflow, canvas"
description: "A service expert comes in two modes: standard mode configures the persona and capabilities on one page, and workflow mode orchestrates multi-step processes and multi-role collaboration on a canvas."
linkTitle: "Service Expert"
weight: 4560
---

## Two modes

A service expert targets **job assistants** and **business processes**. Both modes share one runtime, and the mode cannot be changed after creation:

| Mode | Page | Best for |
|------|------|----------|
| Standard | `/studio-preview/expert/:id` | A job assistant that is ready once the persona and capabilities are set on one page |
| Workflow | `/studio-preview/orchestration/:id` | Business processes that need multi-step orchestration or multi-role collaboration |

Neither has a container, so there is no start, pause, or online/offline state; a service expert can be talked to right after creation.

## Standard mode

The page is configuration on the left and debugging on the right.

### Left column

From top to bottom:

| Section | Contents |
|---------|----------|
| Model | Pick from the models listed by the current model gateway |
| Persona and greeting | Persona (Markdown edit / preview), greeting, up to four suggested questions |
| Skills | Pick from platform skills and built-in skills |
| Tools | Built-in tools and MCP servers, using the same drawer as the digital twin |
| Knowledge base | Bind model platform knowledge bases |

The persona section has **Generate from the description** in its header: it becomes available once the job description reaches 10 characters, and the draft dialog contains only the persona block. Clicking **Use** writes back the persona alone, leaving the greeting and suggested questions unchanged.

### Right column

The right column is the chat pane, with a session list, message stream, input box, and **New chat**. Unsaved configuration is not treated as active: save first, then talk, to see the current configuration at work.

### Validation

| Field | Limit |
|-------|-------|
| Job description | 500 characters |
| Persona | 2000 characters |
| Greeting | 300 characters |
| Each suggested question | 60 characters |

An empty name or one shorter than 2 characters is flagged in place without sending a request; over-limit fields are marked red below the field.

## Workflow mode

Workflow mode opens the flow canvas. The left side is the node library with two tabs, **Base nodes** and **Capability nodes**.

### Base nodes

18 orchestration primitives, grouped by purpose:

| Group | Nodes |
|-------|-------|
| Input and perception | Input, multimodal understanding |
| Planning and agents | Task planning, LLM, agent, skill, sub-agent |
| Knowledge and context | Knowledge retrieval, knowledge base Q&A, QA knowledge retrieval, memory |
| Tools and actions | Tool, code, report |
| Control and trust | Conditional branch, result validation, human approval, output |

A few points worth knowing:

- A **sub-agent** node can delegate to an uploaded agent template and scope its tools and knowledge, which is how multi-role collaboration is built.
- A **conditional branch** picks a path by expression; the branch not taken shows "Branch not selected, skipped".
- A **code** node runs pure computation in an isolated sandbox: it cannot reach the process or the network, and an infinite loop is interrupted by timeout.
- **QA knowledge retrieval** returns a matched answer directly without calling a model.

### Capability nodes

The **Capability nodes** tab lists the tools and skills already bound, so a click adds a fully configured node instead of adding an empty node and picking in the inspector. You can also **create a tool** or **create a skill** here.

### Configuration errors

When a node is misconfigured, the same message appears in three places: the node draws a red border and shows the first error, the inspector marks the offending parameter red below it, and running is blocked with the canvas focused on the first node with an error.

### Running and debugging

After a run starts, the debug window lists results per node. When a node fails it lists the reason, and clicking it selects and centers that node on the canvas.

## Import and export

Workflow mode can export a workflow as platform JSON, Bisheng, n8n, or Dify from the card's **More** menu, and can import Dify tool catalogs and agent packages. Replacing a configuration on import asks for confirmation; after the replacement the name, avatar, and tags stay as they were, and the previous configuration is still recoverable from the version history.

## Related operations

- [Digital twin](./digital-twin)
- [Publishing](./publish)
- [Versions and restore](./versions)
- [Capability assets](./assets)
