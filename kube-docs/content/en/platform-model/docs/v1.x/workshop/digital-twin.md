---
title: "Digital Twin"
keywords: "Industry AI Model Platform, Agent Workshop, digital twin, Claw, sandbox, persona, run mode, growth"
description: "A digital twin is an agent that works on its own in a sandbox (Claw): configure persona, skills, tools, knowledge, and run mode, verify it in the chat pane, and let it accumulate long-term memory and skills as it works."
linkTitle: "Digital Twin"
weight: 4540
---

## What is a digital twin

A digital twin is **an agent that works on its own in a sandbox (Claw)**: in its own runtime it plans the steps, writes code, and calls skills and tools to finish a task instead of waiting for step-by-step instructions.

It suits roles that need long-term memory, scheduled tasks, and autonomous execution, such as a sales assistant that keeps following up on customer feedback, or an operations assistant that summarizes information every day.

The page does not expose the user space, template repository, cluster, or compute specification: the workshop picks the runtime environment itself.

## Page layout

The left column is configuration, the right column is debugging, filling the content area. On narrow screens they stack vertically.

The left column is grouped into collapsible sections. **Basic information**, **Persona and greeting**, and **Skills** are open by default; the rest start collapsed. Each section header has an arrow on the left and shows the selected count or current value on the right.

## Basic information

Avatar, name, description, and tags appear in the header on the left. Click the pencil next to the name to open the **Edit basic information** dialog; saving creates a new version.

The description is limited to one line (480px above 1280 wide, 340px below), truncated with the full text on hover, and shows "No description yet" when empty.

## Persona and greeting

The **persona** is the twin's tone, boundaries, and what it must not do, written as a Markdown document. The editor switches between **Edit** and **Preview** in the top right, rendering headings, lists, emphasis, and code; the character count and limit sit below.

The persona can be drafted with **Generate from the description** and then edited by hand. The same section holds the **greeting** and up to four **suggested questions**.

## Capabilities

| Section | Contents |
|---------|----------|
| Skills | Pick from platform skills and built-in skills; the drawer groups them by source |
| Tools | Built-in tools (grouped) and MCP servers in one place; **Add** opens the right drawer, and switching to the MCP category reads each server's tools automatically |
| Knowledge base | Bind model platform knowledge bases; answers retrieve within the namespace |
| Workflows | Bind an existing service expert workflow |
| Scheduled tasks | Let the twin act on a schedule, with common frequencies and cron expressions |

Capability sections list **only what is selected**, each row removable. Candidates live in the right drawer where you search and check them, never laid out on the page.

## Run mode

The run mode decides how far the twin may act on its own. There are three options:

| Mode | Description |
|------|-------------|
| Observe | Read-only; see what it would do before letting it act |
| Draft | Low-risk actions run directly; high-risk actions wait for confirmation |
| Semi-autonomous | More actions are released, with the high-risk boundary still confirmed by a person |

Switching the run mode resets the tool switches, but does not affect bound knowledge bases, workflows, or MCP servers.

## Growth

**Growth** is what the twin accumulates as it works. It builds this up in conversation and you can review and correct it:

- **User profile**: what it remembers about you.
- **Memory notes**: the lessons and experience it has summarized.

Both are Markdown documents with the same edit/preview toggle. Saving by hand writes immediately; an already-open conversation keeps using the snapshot it started with, and the next new conversation reads the updated content.

Growth survives container rebuilds: after a write, the container's sync loop commits it back to the space repository, and a rebuilt container reads it back.

## Debugging and terminal

The right column has two tabs:

- **Chat**: talk to the twin to verify the effect. Unsaved configuration is not treated as active.
- **Terminal**: get into the twin's own container to troubleshoot. It stays disabled with typed input preserved while the container is not ready.

## Container state

A digital twin has its own run state (running, starting, pausing, paused, error, unknown), shown separately from the publish state. Both the card and the builder can start or pause it: while running only pause is offered; while paused or in error only start.

While the container is not ready, saving growth, changing scheduled tasks, and sending in the terminal stay disabled, and what you typed is preserved.

## Related operations

- [Service expert](./service-expert)
- [Publishing](./publish)
- [Versions and restore](./versions)
- [Knowledge base](./knowledge)
- [Capability assets](./assets)
