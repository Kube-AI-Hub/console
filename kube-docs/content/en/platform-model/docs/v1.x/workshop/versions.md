---
title: "Versions and Restore"
keywords: "Industry AI Model Platform, Agent Workshop, versions, restore, configuration as code, automatic growth"
description: "Every save of an agent is a commit in its Git repository. The version list distinguishes manual saves, automatic growth, restores, and imports, and any version can be restored."
linkTitle: "Versions and Restore"
weight: 4600
---

## Configuration as code

An agent's static configuration lives in its own Git repository: **a save is a commit**, and a failed commit means a failed save. The configuration is therefore auditable, diffable, and directly reusable as a template.

## Version types

The commit message says what kind of version it is:

| Type | When it appears |
|------|-----------------|
| Manual save | Saving the configuration or editing basic information |
| Automatic growth | A digital twin updated its user profile or memory notes in conversation |
| Restore | Restoring from an older version |
| Import | A migration import, or replacing the configuration from a card |

Commits without a prefix are shown as manual saves.

**Automatic growth** is checked after each reply: it commits only when the growth files changed, and it does not turn a published twin into "published · new changes".

## Viewing versions

Click **Versions** in the builder header to open the dropdown panel. Each row shows the type label, message, short sha, relative time, author, a "current" or "published" marker, and a **Restore** action. The list shows 20 per page with load more.

You can add a version note when saving; without one it reads "Save <name>".

## Restoring a version

Pick an older version and click **Restore**. After a confirmation:

- The old configuration is written back as a **new commit** (`restore: restore to <sha8> (original message)`), so history is never rewritten and later versions remain.
- A digital twin also writes the persona and growth back to its container and refreshes the configuration.

When there are unsaved changes, the confirmation warns that they will be lost.

## Related operations

- [My agents](./agents)
- [Digital twin](./digital-twin)
- [Publishing](./publish)
