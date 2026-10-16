---
title: "Publishing"
keywords: "Industry AI Model Platform, Agent Workshop, publishing, API, service token, chat page, iframe"
description: "All three agent types publish the same way: once published, members of the same tenant can chat, and the platform provides one API address, a service token, and a chat page."
linkTitle: "Publishing"
weight: 4580
---

## Publish states

All three agent types have only three publish states:

| State | Meaning | Who can chat | API |
|-------|---------|--------------|-----|
| Draft | Never published, or publishing was cancelled | Creator, tenant administrators | 404 |
| Published | The public version equals the commit made at publish time | Members of the same tenant | Available |
| Published · new changes | Saved or restored after publishing | Members of the same tenant (on the published version) | Available |

A digital twin additionally has a run state, shown separately from the publish state. Service experts have no run state and can be talked to right after creation.

## Publishing an agent

Click **Publish** in the builder header:

1. Unsaved changes are saved first; if saving fails, publishing does not happen.
2. The **Publish for external use** dialog opens with two blocks.

**API access** gives the call address, a service token shown only once, and a curl example:

```
POST <site>/studio-openapi/agents/<key>/invoke
```

The body is `{"input": "..."}`, and the response is `{id, agent_id, session_id, status, output, elapsed_ms}`. All three agent types return the same shape. A digital twin call is routed to its own container, which returns 409 while the container is not ready.

**Chat page** gives a link you can share directly and iframe embed code:

```
<site>/studio-preview/chat/<key>
```

The chat page requires a login in the same tenant; anonymous access is not offered. It shows only this one agent, with no way to switch or remove it.

## Updating a publication

If the agent was saved after publishing, the dialog notes that the public version is still the one from publish time, and **Update publication** becomes available. Without new changes that button is disabled.

## Cancelling a publication

The bottom left of the dialog can cancel the publication. The API then returns 404 immediately, other members of the tenant can no longer chat, and the chat page reports that it is unpublished; the creator can still chat. Publishing again reuses the same token.

## Service tokens

Only the hash of a service token is stored; the plain text is shown once at publish time. After rotation the old token stops working immediately, so keep it somewhere safe.

## Related operations

- [My agents](./agents)
- [Versions and restore](./versions)
- [Tenant and permissions](./tenancy)
