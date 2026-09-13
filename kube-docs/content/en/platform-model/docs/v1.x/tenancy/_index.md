---
title: "Tenants and Compute Placement"
keywords: "Industry AI Model Platform, tenant, workspace, public tenant, compute project"
description: "The model platform shares Console tenants (workspaces). Covers the public tenant, enterprise tenants, org binding, list scope, and compute projects."
linkTitle: "Tenants and Compute Placement"
weight: 500
icon: "/images/docs/platform-model/model.svg"
---

A tenant on the Industry AI Model Platform is the same **Tenant (Workspace)** in the Console, backed by the Kubernetes Workspace resource. The platform does not add a separate Tenant CR. Create enterprises, invite members, and set quotas in the Console. The Hub only switches the current tenant, writes new objects into that tenant, and filters lists.

Until you join an enterprise or switch away, the current tenant is the **public tenant** `public`. Every signed-in user belongs to it implicitly. Do not invite people into `public`, and do not confuse it with the system tenant `system-workspace`.

## How objects get a tenant

| Object | How the tenant is set | Can you rebind |
|--------|-----------------------|----------------|
| Organization | Taken from the current tenant at create time; **Tenant** on the form is read-only | Cannot move across tenants; empty means `public` |
| Personal repository | Current tenant at create time | Updates do not change it; transfer to an org follows that org |
| Org repository | Follows the org; the top bar does not override it | Follows the org |
| User | **Not** bound to a single tenant. Public counts everyone; an enterprise tenant counts members of orgs in that tenant | The same person can appear in more than one tenant's stats |
| Inference, fine-tune, notebook, evaluation, and Space instances | Written with the current tenant and the selected **compute project** (Kubernetes project / namespace) | Existing instances do not move when you switch |

Organizations own repository ACL (public / private, members). Workspace and project roles govern tenant switching, launching instances, and who sees portal entries. Do not treat the two membership planes as one.

## Related pages

- [Switch tenants](./switch_tenant)
- [List scope and admin](./lists_and_admin)
- [Compute projects and visibility](./compute_and_visibility)
- Console: [Tenant (Workspace) Overview](/docs/v3.4/workspace-administration/what-is-workspace/)
- Console: [Create Tenants (Workspaces), Projects, Users and Roles](/docs/v3.4/quick-start/create-workspace-and-project/)
