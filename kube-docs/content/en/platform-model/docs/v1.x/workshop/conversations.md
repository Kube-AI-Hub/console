---
title: "Conversations and Tasks"
keywords: "Industry AI Model Platform, Agent Workshop, conversations, sessions, scheduled tasks, run records"
description: "Conversations & tasks lists only the agents the current user has talked to, supports multiple sessions per agent, and shows a digital twin's scheduled tasks."
linkTitle: "Conversations and Tasks"
weight: 4620
---

## Page scope

`/studio-preview/conversations` shows only the agents the **current user has talked to**. A service expert built by someone else appears here once you have talked to it; agents you never talked to do not appear.

Conversations already held are kept even after the agent is unpublished.

## Layout

- **Top**: an agent search selector with an avatar and a "switch agent" hint. The runtime name is not shown.
- **Left**: a **New chat** button under the page title, then a scrollable session list filling the rest of the height.
- **Center**: the message stream and input box of the current session.

## Session management

You can have several sessions under the same agent, one per topic.

- **New chat**: starts as a local draft and joins the list once the first message is sent.
- **Rename**: hover a session to get a "..." menu; choosing edit opens a dialog. After the first successful reply the platform summarizes a title with a model; if that fails it falls back to the first user message, and a hand-edited title is never overwritten.
- **Delete**: from the same menu.

## Message rendering

The message area supports Markdown, code highlighting, tables, collapsible execution traces, tool call labels, and multimodal attachments.

While a reply is generating, the attachment and voice buttons are disabled and the text box keeps focus so you can type the next message; Enter will not send another one until generation finishes. You can still switch agents at any time.

## Scheduled tasks

When the current agent is a digital twin, its scheduled tasks appear under the session list with the same fields as the builder, and can be paused and resumed directly. Creating and deleting still happens in the builder.

While the container is not ready, the tasks last read are listed with a note that they cannot be changed for now. Results of a scheduled run are recorded on the task rather than in a new conversation session.

## Who can chat

- Draft: only the creator and tenant administrators can start a new conversation.
- Published: any member of the same tenant.
- While a digital twin is not running, the page waits and does not drop what you typed.

## Related operations

- [My agents](./agents)
- [Digital twin](./digital-twin)
- [Tenant and permissions](./tenancy)
