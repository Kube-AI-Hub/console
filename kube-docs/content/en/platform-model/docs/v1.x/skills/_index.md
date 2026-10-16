---
title: "Skills"
keywords: "Industry AI Model Platform, skills, Skill, skill repository, agent capability"
description: "A skill repository hosts skill definitions and files that agents or workflows can reuse, with search, import, and version management."
linkTitle: "Skills"
weight: 4800
icon: "/images/docs/platform-model/skills.svg"
---

## What is a skill repository

A skill repository hosts **skill definitions and files that agents or workflows can reuse**. A skill is a capability asset: written once, referenced by many agents, and an upgrade takes effect for every agent that references it.

Skills are referenced in the Agent Workshop: the **Skills** section of a digital twin or service expert picks from platform skills, and the workflow canvas's **Capability nodes** can add a node with a skill already bound.

## List

Go to **Data & Assets → Skills** (`/skills`).

- The top holds search and sorting, an **All / Mine** scope switch (default "All", hidden when signed out), and **+ New**.
- The left side filters by tag, and the main area is a card grid.
- Click a card to open its detail page.

The scope matches the model library: **public repositories in the public tenant plus repositories in the current tenant**. Public lists are readable without signing in.

## Creating a skill

Click **+ New**, or open `/new?type=skill` (the old `/skills/new` redirects here).

The form mirrors code repositories: owner on the left, English name on the right, the remaining fields stacked. There are three ways to create:

| Way | Description |
|-----|-------------|
| Empty repository | Upload files on the web or with Git afterwards |
| Git URL | Provide a source URL and mirroring is configured once creation finishes |
| Archive import | Upload an archive to import files in one go |

The **English name is part of the path and cannot be changed after creation**, so confirm it before submitting.

On success the platform creates the Git repository and a `README.md`.

## Detail

Opening `/skills/:namespace/:name` shows the README, metadata, and download statistics by default.

The tabs are **Overview / card**, **Files**, and **Settings**:

- **Files**: browse the tree and file contents on the web, and create or upload files.
- **Settings**: change the alias, description, tags, and visibility.

## Using skills in an agent

In the Agent Workshop builder, **Add** in the **Skills** section opens a drawer whose left column groups by source:

| Group | Contents |
|-------|----------|
| Platform skills | Skill repositories on this platform |
| Built-in skills | Skills shipped with the runtime |

The section lists only selected skills, each row removable.

## Admin console

Administrators can search skill repositories in **Skill management** (`/admin_panel/skills`), review visibility and weight, open the detail page to set weight or change visibility, and delete one or many. The interaction matches code management.

## Related operations

- [Create a skill](./create_skill)
- [Unified creation](../new_hub)
- [Agent Workshop / Capability assets](/platform-model/docs/v1.x/workshop/assets)
- [Admin console](../admin/admin_intro)
- [Tenant and compute ownership](../tenancy/)
