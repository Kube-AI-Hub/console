---
title: "Update Models"
keywords: "Industry AI Model Platform, update model, edit model, model settings, delete model"
description: "How to edit model files, modify model repository settings, and delete a model repository."
linkTitle: "Update Models"
weight: 1040
---

## Edit Model Files

### Local Editing

Clone the repository locally via Git or SDK, edit the files, then commit and push.

```bash
# Clone the model repository
git clone https://<platform-host>/<namespace>/<model-name>
cd <model-name>

# Edit files
# (make your changes)

# Commit and push
git add .
git commit -m "Update model files"
git push
```

For authentication, use an access token:

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<model-name>
```

### Online Editing

The platform supports editing text files directly in the Web interface:

1. Navigate to the **Files** tab of the model repository.
2. Click the file you want to edit (e.g., `README.md`, `config.json`, or other text files).
3. Click the **Edit** button in the upper-right corner of the file content area to enter edit mode.
4. After making changes, enter a commit message and click the **Commit** button to save.

{{< notice note >}}
Online editing only supports text files. Binary files (such as model weight files) must be updated via Git or CLI tools.
{{</ notice >}}

## Modify Repository Settings

Navigate to the **Settings** tab of the model repository to view and modify basic repository information.

### Modifiable Settings

| Setting | Description |
|---------|-------------|
| Nickname | Display name of the model, can be changed at any time |
| Description | Description text for the model |
| Visibility | Switch between **Public** and **Private**. When set to private, only authorized users can access the repository |
| Task Tags | Set the model's task type tags (e.g., `text-generation`, `image-classification`, etc.) |
| Industry Tags | Set the industry classification tags the model applies to |

### Non-Modifiable Settings

| Setting | Description |
|---------|-------------|
| Model English Name | Unique identifier of the model repository, cannot be changed after creation |

{{< notice note >}}
When you modify task tags or industry tags, the system automatically updates the YAML metadata header in the `README.md` file. If you have manually edited the metadata, be aware that tag changes may overwrite existing metadata content.
{{</ notice >}}

## Delete a Model

If a model repository is no longer needed, it can be deleted.

1. Navigate to the **Settings** tab of the model repository.
2. Scroll to the **Danger Zone** section at the bottom of the page.
3. Click the **Delete Model Repository** button.
4. In the confirmation dialog, enter the full model name (in the format `namespace/model-name`) to confirm deletion.
5. Once confirmed, the model repository and all its files and commit history will be permanently deleted.

{{< notice note >}}
Deletion is irreversible. All data in the model repository — including files, commit history, and configuration — will be permanently deleted and cannot be recovered. Make sure to back up any files you need before deleting.
{{</ notice >}}
