---
title: "Tenant and Permissions"
keywords: "Industry AI Model Platform, Agent Workshop, tenant, permissions, visibility, creator"
description: "The workshop shares one tenant model with the compute and model platforms; agents, conversations, knowledge bases, and memory are hard-isolated per tenant, members of a tenant can view by default, and only the creator and administrators can manage."
linkTitle: "Tenant and Permissions"
weight: 4680
---

## Tenant

The workshop shares the same tenants as the compute and model platforms (KubeSphere Workspaces). Without switching, you are in the **public tenant**.

The tenant switcher sits between the language and avatar controls in the top bar and shows "Public tenant" by default. Switching tenants reloads the page; existing objects do not move with you.

## Visibility

```text
Current tenant
  ├── Agents / conversations / knowledge bases / memory: workspace = current tenant only
  └── Skills / MCP / tools / templates: public repositories in the public tenant OR the current tenant
```

- Agents, conversations, knowledge bases, and long-term memory are **hard-isolated** by the current tenant. Agents from other tenants do not appear in the list, and a direct link cannot open them.
- Capability assets (skills, MCP, tools, agent templates) use the same scope as the model library, see [Capability assets](./assets).

## Who can do what

| Action | Creator | Tenant administrator | Other members of the tenant |
|--------|---------|----------------------|-----------------------------|
| View and chat (published) | Yes | Yes | Yes |
| View and chat (draft) | Yes | Yes | Not visible |
| Open builder, duplicate, publish, start or stop, delete, edit tags | Yes | Yes | Disabled with an explanation |

Without permission, management actions are disabled with the note "Only the creator or an administrator can edit".

## Tenant ownership of conversations

A conversation record carries `user_id` and `workspace`, and the **Conversations & tasks** list returns only the sessions of the **current tenant and current user**. Switching tenants swaps the list.

## Related operations

- [My agents](./agents)
- [Conversations and tasks](./conversations)
- [Capability assets](./assets)
- [Tenant and compute ownership](/platform-model/docs/v1.x/tenancy/)
