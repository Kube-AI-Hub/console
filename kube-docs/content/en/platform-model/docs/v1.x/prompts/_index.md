---
title: "Prompt Library"
keywords: "Industry AI Model Platform, prompt library, Prompt, prompt management, prompt editor"
description: "A prompt library manages a set of prompts as a repository: create a library, then add, edit, duplicate, and delete individual prompts inside it."
linkTitle: "Prompt Library"
weight: 4970
icon: "/images/docs/platform-model/prompts.svg"
---

## What is a prompt library

A prompt library manages a set of prompts **as a repository**: create a library first, then manage individual prompts inside it.

Keeping prompts together means one prompt can be reused in several places and a single edit applies everywhere, instead of copy-pasting between scripts.

## Library home

Go to **Data & Assets → Prompt library** (`/prompts/library`).

- The home page lists the prompt libraries you can see, with name search and pagination.
- Click a card to open a library (`/prompts/library/:namespace/:name`).
- Signed-in, unrestricted accounts see a **New** entry.

## Creating a library

The English library name is part of the repository path and **cannot be changed after creation**. The remaining fields (alias, description, visibility) mirror other repositories.

## Library detail and prompt editing

Opening a library lists its prompt files. You can:

| Action | Description |
|--------|-------------|
| Add | Create a new prompt inside the library |
| Edit | Open the editor to change the title and body; saving writes back to the repository |
| Duplicate | Copy an existing prompt as a starting point |
| Delete | Remove a single prompt |

The editor covers the title and the body, and saving writes back to that library's Git repository, so history stays traceable.

## Visibility

The scope matches the model library: **public repositories in the public tenant plus repositories in the current tenant**.

## Related operations

- [Unified creation](../new_hub)
- [Model repositories](../model/)
- [Tenant and compute ownership](../tenancy/)
