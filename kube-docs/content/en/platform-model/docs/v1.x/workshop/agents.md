---
title: "My Agents"
keywords: "Industry AI Model Platform, Agent Workshop, agent list, create agent, agent card"
description: "View, create, and manage agents in the Agent Workshop: list scope, creation flow, card contents, and the actions on a card."
linkTitle: "My Agents"
weight: 4520
---

## Two lists

The workshop has two pages that list agents, using the same card:

| Page | Path | Scope |
|------|------|-------|
| My builds | `/studio-preview/agents?scope=mine` | Only agents created by the current user |
| Build & debug | `/studio-preview/build` | Every agent the current tenant can view, including ones created by others in the same tenant |

Neither list shows agents from other tenants, and a direct link cannot open them either. Build & debug additionally shows the creator.

Both support filtering by type (all / digital twin / service expert) and keyword search, 10 per page. The list refreshes silently every 10 seconds and whenever the page becomes visible again.

## Creating an agent

Click **Create** in either list; the dialog asks for a mode first:

- **Digital twin**: fill in name, description, and tags only, then continue on the builder page with the persona and capabilities.
- **Service expert · Standard**: fill in name, description, and tags only, then continue with the persona, greeting, and capabilities.
- **Service expert · Workflow**: besides name, description, and tags, pick a template or check **Generate the workflow from the description** (the description needs at least 10 characters), then continue to the canvas.

The name is required, at least 2 and at most 70 characters. Tags are comma-separated, up to 24 characters each and 12 in total. **Continue** stays disabled until a mode is picked.

The toolbar also offers **Import**, which creates a service expert workflow directly from an exported orchestration file.

## Card contents

From top to bottom, each card shows:

1. **Header**: avatar, name, mode subtitle; top right holds the publish state (draft / published / published · new changes), and a digital twin adds a run state badge.
2. **Description**: truncated to two lines, or "No description yet".
3. **Tags**: click to add to the filter; with permission, an **Edit** action at the end of the row edits them in place.
4. **Footer**: state text on the left, relative time on the right; build & debug also shows the creator.
5. **Primary actions**: **Open builder** (called "Orchestrate & run" for workflows) and **Open chat**.
6. **Tool row**: duplicate, publish (drafts only), start or pause (digital twins only), and **More**.

The **More** menu holds: import (replaces this agent's configuration, with a confirmation first), export (platform JSON / Bisheng / n8n / Dify; not offered for digital twins), create workspace (published workflows), and delete (with confirmation; a digital twin also deletes its user space).

## Who can chat

- Draft: only the creator and tenant administrators.
- Published: any member of the same tenant.
- Digital twin: it must also be running (or sleeping but wakeable), otherwise the button is disabled with an explanation.

## Permissions

Members of the same tenant can view and chat by default. Only the creator and tenant administrators can open the builder, duplicate, publish, start or stop, edit tags, or delete. Without permission those actions are disabled with the note "Only the creator or an administrator can edit".

## Related operations

- [Digital twin](./digital-twin)
- [Service expert](./service-expert)
- [Publishing](./publish)
- [Versions and restore](./versions)
- [Tenant and permissions](./tenancy)
