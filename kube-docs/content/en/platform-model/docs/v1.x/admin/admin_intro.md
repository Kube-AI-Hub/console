---
title: "Admin Console in Detail"
keywords: "Industry AI Model Platform, admin console, asset management, code management, model management, dataset management, spaces, MCP, weight, bulk delete"
description: "Lists, details, editing and deletion for code, models, datasets, spaces and MCP under asset management, and how that differs from compute specification management."
linkTitle: "Admin Console in Detail"
weight: 8010
---

## Where to manage things

Sign in as a platform administrator and open **Admin Console** from the avatar menu. The left menu is divided into **System**, **Account**, **Asset Management** and **Compute Resource**.

Asset management covers repository-style resources. **Compute Resource** holds compute specification management, runtime framework and image management, and public inference services. **Compute specification management** (`/admin_panel/space_resources`) decides which CPU/GPU/NPU specifications are selectable when creating an inference, fine-tuning or development instance. Do not change specifications from the spaces list. The specification list can be searched by name and filtered by compute type, accelerator model and status, with the filter fields on the same row as creation and bulk delete.

Lists and the dashboard cover the current tenant only. The compute resource overview summarises quota and usage for the compute projects under the current tenant; it is not whole-cluster node inventory. The specification table itself does not switch with the tenant.

| Menu | Path | What it does |
|------|------|--------------|
| **Code management** | `/admin_panel/codes` | Code repository list, detail, visibility, weight, single and bulk delete |
| **Model management** | `/admin_panel/models` | Model list, creation, detail, alias/source/weight, sync, inline delete (no bulk delete) |
| **Dataset management** | `/admin_panel/datasets` | Dataset list, creation, source, single and bulk delete (no admin detail page) |
| **MCP management** | `/admin_panel/mcps` | MCP repositories as above; list and detail show the tool count |
| **Space management** | `/admin_panel/spaces` | Space repositories as above; list and detail show the license |
| **Skill management** | `/admin_panel/skills` | Skill repositories; the interaction matches code management |
| **Compute specification management** | `/admin_panel/space_resources` | Compute resource: specification list, filters, create / edit / bulk delete |
| **Runtime framework and image management** | `/admin_panel/runtime_frameworks` | Compute resource: inference / fine-tuning / evaluation / Notebook / task images |
| **Public inference services** | `/admin_panel/serverless` | Compute resource: local deployments and cloud API channels |

The administrator user detail page **does not offer user deletion**. The platform does not import skills or other types from GitLab.

## Asset management

Besides code, models, datasets, MCP and spaces, asset management covers the following repository types, all with the same interaction as code management:

| Menu | Path | What it does |
|------|------|--------------|
| **Skill management** | `/admin_panel/skills` | Skill repositories, reused by agents and workflows |
| **Agent templates** | Asset management | Agent template repositories, delegable from sub-agent nodes in a workflow |
| **Prompt library** | Asset management | Prompt library repositories |
| **Collections** | Asset management | Collections, which are not Git repositories |

Visibility, weight, single and bulk delete for skills and agent templates match code management.

## Code / MCP / space management

These three share one set of list, detail and edit interactions.

### List

- **Search**: the placeholder is "Search name / owner"; input refreshes after roughly 0.5s of debounce and can be cleared.
- **Count badge**: the total number of repositories under the current filter (codes / MCPs / spaces).
- **Bulk delete**: disabled until something is selected. Selecting shows a confirmation dialog (confirm / cancel); confirming deletes one by one via `DELETE /{type}/{namespace}/{name}` and shows "deleting done/total" while it runs.
- **Columns**: name (links out to the front-end repository), owner, visibility (public / private), weight; MCP also shows **tool count** and spaces also show **license**.
- **Inline actions**: **Detail**, **Delete** (also confirmed; cancelling has no effect).
- **Pagination**: previous / page numbers / next, 10 rows per page.

### Detail

The detail page returns to the list via the back button at the top left or the breadcrumb. Fields:

| Field | Notes |
|-------|-------|
| Name | Repository name |
| Owner | Namespace |
| Creator | Creating account |
| Visibility | Public / private |
| Weight | Operations recommendation weight, default 1 |
| Tool count | MCP only |
| License | Spaces only |
| Sensitivity check status | Result of the content check |
| Created at | `YYYY-MM-DD HH:mm:ss` |

Buttons at the bottom:

- **Edit**: opens the visibility editing page.
- **Set weight**: opens a dialog; enter an integer and then **Cancel** or **Update**. Update calls `POST /recom/opweight` with `{ "repo_id", "weight" }`. The community edition writes the weight, but the list and detail may still read back the default of 1.

### Edit visibility

The switch toggles between public and private. **Update visibility** calls `PUT /{type}/{namespace}/{name}` with `{ "private": true|false }`.

## Model management

The list also searches by name / owner and shows a count badge, name link, owner, visibility, weight, **source** (HuggingFace / ModelScope / Industry AI Model Platform / user upload), detail, delete and pagination.

Differences from code management:

- It offers **New model**, which goes to the user-side `/models/new`.
- There is **no bulk delete**; only inline delete (cancel / confirm).

### Model detail

Besides the common fields it also shows **model alias** and **source** (the mirror source address). Once a mirror exists, the last update time and last message appear too.

Buttons at the bottom:

- **Edit model**
- **Set weight** (cancel / update, same API as above)
- **Sync** / **Resync**: without a mirror it only says "fill in and save the mirror source before syncing" and starts no task
- If inference is enabled for the model: **New Serverless** or **Serverless detail**

### Model editing

| Field | Editable |
|-------|----------|
| Name / owner / creator / sensitivity check / created at | Read-only |
| Model alias | Editable; cannot be empty when saving |
| Visibility | Switch |
| Weight | Numeric input |
| Source | Mirror source address; saving creates or updates the sync task |

**Save changes** returns to the detail page. Alias and visibility go through `PUT /models/{namespace}/{name}`, weight through `POST /recom/opweight`, and source through the mirror create / update API.

## Dataset management

The list searches by name / owner, offers **New dataset** (going to `/datasets/new`), and shows a count badge, name link, owner, visibility, **source**, inline delete and pagination.

Selecting rows enables **bulk delete**, with the same interaction as code management. Dataset management has **no** admin detail or edit page; change repository information from the front-end dataset page.

## Unified creation of models and data

Creating models, datasets, code, skills, MCP, prompts and collections on the user side all start from **New model and data** in the avatar menu, which opens `/new` to pick a type. Spaces, development instances and organisations stay in the avatar menu on their own, to avoid confusion with compute resources.

The organisation page's "Create" also funnels into that landing page, while keeping a separate new-space entry. The "New" button on the model and dataset management lists goes straight to the matching form.

| Type | How to create |
|------|---------------|
| Model / dataset | A **Git source address** can be filled in; a mirror sync is set up against it after creation |
| Code / skill / MCP | One of three: an empty repository, a Git URL import, or uploading a local zip/tar |
| Prompt / collection | Only through the unified entry; no Git or archive import |

## Related operations

- [Code repositories](../code/)
- [Model repositories](../model/)
- [Datasets](../dataset/)
- [MCP](../mcp/)
- [Spaces](../space/)
- [Configure inference engines](../inferencefinetune/inference/runtime_framework_admin)
- [Tenant and compute ownership](../tenancy/)
