---
title: "List Scope and Admin"
keywords: "Industry AI Model Platform, this tenant, admin console, Dashboard, source filter"
description: "Admin views show only the current tenant. The Hub default is public repos union the current tenant; This tenant does not include other tenants' public repos."
linkTitle: "List Scope and Admin"
weight: 520
---

The same users, repositories, and instances are filtered differently in admin and on the Hub.

## Hub

On model, dataset, code, skill, MCP, and Space lists:

- **Default**: **public** repos from any tenant ∪ repos in the current tenant, then the usual public / private ACL. Switching to an enterprise does not empty the hub of other tenants' public models.
- **Source filter This tenant**: only the current tenant. It does not fold in other tenants' public repos. This is not **Local** (sync source).
- Cards label **Public tenant**, **Current tenant**, or the enterprise name from the returned tenant field.

Searching users when inviting org members **does not** apply the enterprise tenant filter, so you can still find people who are not in the org yet.

## Admin console

Platform admins open **Admin Dashboard**. Account, asset, running-instance, and compute-usage numbers, and the lists behind those cards, all use the **current tenant**. The UI does not offer **All tenants**.

Switch to the public tenant and open Dashboard: the numbers must match the lists under that tenant. Do not mix users from the public tenant with inference that belongs to an enterprise.

**Still platform-wide, not tenant-scoped:**

- Specification catalog, runtime frameworks, and images
- Dashboard **Operations** (mirror sync, cloud public inference)
- Cluster node inventory when picking a SKU (what cards the cluster has, not tenant quota)

## Related documentation

- [Compute projects and visibility](./compute_and_visibility)
