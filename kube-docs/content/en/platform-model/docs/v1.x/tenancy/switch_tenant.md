---
title: "Switch Tenants"
keywords: "Industry AI Model Platform, tenant switcher, public tenant, enterprise tenant"
description: "How to switch between the public tenant and enterprise tenants, and what refreshes after a switch."
linkTitle: "Switch Tenants"
weight: 510
---

## Entry

After you sign in, the tenant switcher sits between language and the avatar. The menu always includes **Public tenant** plus every tenant (workspace) you have joined. It is hidden when you are signed out.

## How to switch

1. Open the menu and choose **Public tenant** or an enterprise you have joined.
2. The page reloads. Lists, create forms, and the admin console then request data for the new current tenant.
3. Illegal values or enterprises you have not joined fall back to the public tenant. Do not forge an enterprise context in browser storage.

{{< notice note >}}
Existing inference, fine-tune, notebook, and evaluation instances do not move with the switch. They stay on the tenant and compute project used at creation time.
{{</ notice >}}

## Create an organization

Open **New Organization** from the avatar menu. **Tenant** is read-only and equals the current tenant. You cannot pick another one on the form. After submit, the org stays on that tenant.

## Create a repository

For models, datasets, code, skills, MCP, and Spaces:

- Owner is you: the repository is written to the **current tenant**. To land it under an enterprise, switch first, or put it in an organization already bound to that enterprise.
- Owner is an organization: the repository follows the org tenant. The top bar does not override it.

## Related documentation

- [Tenants and compute placement](./)
- [List scope and admin](./lists_and_admin)
