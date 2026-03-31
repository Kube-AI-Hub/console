---
title: "Update Code Repository"
keywords: "Industry AI Model Platform, update code, code editing, repository settings, delete repository"
description: "How to edit code files, modify repository settings, and delete a code repository."
linkTitle: "Update Code Repository"
weight: 3040
---

## Edit Code Files

The platform supports two methods for editing files in a code repository:

### Local Git Editing

Clone the repository locally, edit with any code editor, then commit and push:

```bash
git clone https://<platform-host>/<namespace>/<code-repo-name>
cd <code-repo-name>

# After editing files
git add .
git commit -m "Update code files"
git push origin main
```

### Web Online Editing

1. Navigate to the code repository detail page and click the **Files** tab.
2. Click on the file name you want to edit to open the file viewer.
3. Click the edit button to enter online editing mode.
4. After making changes, enter a commit message and save.

## Modify Repository Settings

Navigate to the code repository detail page and click the **Settings** tab to modify the following:

| Setting | Modifiable | Description |
|---------|------------|-------------|
| Code Repository Path | No | Cannot be changed after creation |
| Nickname | Yes | Click **Update Nickname** to save changes |
| Description | Yes | Click **Update Description** to save changes |
| Visibility | Yes | Switch between **Public** and **Private**; requires confirmation |

## Delete Code Repository

1. Navigate to the code repository detail page and click the **Settings** tab.
2. Scroll to the **Delete** section at the bottom of the page.
3. Type the full repository path (`<namespace>/<repo-name>`) to confirm deletion.
4. Click the **Delete** button.

{{< notice note >}}
Deletion is irreversible. The code repository and all its files, commit history will be permanently removed. Please proceed with caution.
{{</ notice >}}

## Related Documentation

- [Create Code Repository](./create_code)
- [Upload Code](./upload_code)
- [Download Code Repositories](./download_codes)
