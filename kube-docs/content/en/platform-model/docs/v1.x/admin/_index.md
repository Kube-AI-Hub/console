---
title: "Admin Console"
keywords: "Industry AI Model Platform, admin console, asset management, code management, MCP, spaces, skills"
description: "How administrators manage models, datasets, code, skills, MCP and spaces in the admin console, and how that differs from compute specification management."
linkTitle: "Admin Console"
weight: 8000
icon: "/images/docs/platform-model/admin.svg"
---

## What the admin console is

The admin console is the entry point for system and asset management on the Industry AI Model Platform. Sign in as a platform administrator and open **Admin Console** from the avatar menu.

It is divided into System, Account, **Asset Management** and **Compute Resource**. Asset management covers repositories for code, models, datasets, MCP, spaces and skills. **Compute Resource** holds compute specification management, runtime framework and image management, and public inference services. The specification page (`space_resources`) decides which hardware specifications an inference, fine-tuning or development instance can pick; do not confuse it with the repository menus.

The dashboard, the asset management lists, and instances and tasks all show **the current tenant only**. Switching tenants reloads the whole page, and the numbers must line up with the lists you open. The specification catalogue, runtime frameworks and the operations area (sync, cloud public inference) remain platform-wide. See [List scope and admin](../tenancy/lists_and_admin) for details.

## Related documentation

- [Admin console in detail](./admin_intro)
- [Tenant and compute ownership](../tenancy/)
