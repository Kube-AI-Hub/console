---
title: "Upload Code"
keywords: "Industry AI Model Platform, upload code, Git upload, web upload, Git LFS"
description: "How to upload code files to a platform repository via the web interface or Git commands."
linkTitle: "Upload Code"
weight: 3030
---

## Upload Methods Overview

The platform supports two methods for uploading code files:

| Method | Use Case |
|--------|----------|
| Web Upload | Upload a small number of files at once (max 5 MB per file, up to 5 files) |
| Git Upload | Suitable for batch uploads or larger files |

## Web Upload

1. Navigate to the code repository detail page and click the **Files** tab.
2. Click the **Upload File** button.
3. Drag and drop or select files to upload (max 5 MB per file, up to 5 files).
4. Enter a commit title (up to 200 characters) and an optional commit description.
5. Confirm the branch is `main` and click **Submit** to complete the upload.

## Git Upload

For larger projects or batch uploads, use the Git command line.

### Clone the Repository

```bash
git clone https://<platform-host>/<namespace>/<code-repo-name>
```

For private repositories, use an access token:

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<code-repo-name>
```

### Add and Commit Files

After copying your code files into the repository directory, run:

```bash
cd <code-repo-name>
git add .
git commit -m "Initial commit"
git push origin main
```

{{< notice note >}}
If your repository contains large files (such as model weights or datasets), it is recommended to use Git LFS (Large File Storage). Install Git LFS first and track the large file types:

```bash
git lfs install
git lfs track "*.bin"
git lfs track "*.h5"
git add .gitattributes
git add .
git commit -m "Add large files with LFS"
git push origin main
```
{{</ notice >}}

## Related Documentation

- [Create Code Repository](./create_code)
- [Update Code Repository](./update_code)
- [Download Code Repositories](./download_codes)
