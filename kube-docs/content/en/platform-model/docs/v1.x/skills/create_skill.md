---
title: "Create a Skill"
keywords: "Industry AI Model Platform, create skill, skill repository, Git import"
description: "How to create a skill repository: owner and English name, the three creation methods, and what to do after creation."
linkTitle: "Create a Skill"
weight: 4810
---

## Entry

Either way works:

- Click **+ New** in the skill list.
- Open `/new?type=skill` directly. The old `/skills/new` redirects here.

## Form fields

| Field | Required | Description |
|-------|----------|-------------|
| Owner | Yes | Defaults to the signed-in user; switch to an organization if you belong to one |
| English name | Yes | Part of the repository path, **cannot be changed after creation**; 2–64 characters, starting with a letter and ending with a letter or digit, allowing letters, digits, `-`, `_`, `.` |
| Alias | No | A Chinese or friendly name |
| Description | No | Briefly say what problem this skill solves |
| Visibility | Yes | **Public**: visible to members of the same tenant; **Private**: only authorized users |
| Source URL | No | With a Git URL, mirroring is configured once creation finishes; empty creates an empty repository |
| Archive | No | Upload an archive to import files in one go |

On success the platform creates the Git repository and a `README.md`.

## Initializing files

There are two ways to upload afterwards:

- **Web upload**: open the **Files** tab on the detail page to create or upload files.
- **Git upload**: push files over HTTPS, SSH, or the command line.

A skill's definition lives in its skill file, which agents and workflows call. Write in `README.md` what the skill does, what input it needs, and what it produces.

## Related documents

- [Skills](./)
- [Unified creation](../new_hub)
- [Download code repositories](../code/download_codes)
