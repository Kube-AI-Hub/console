---
title: "Download Spaces"
keywords: "Industry AI Model Platform, download space, git clone"
description: "How to clone and download Space repositories using Git or CLI tools."
linkTitle: "Download Spaces"
weight: 4100
---

## Download Methods

A Space is essentially a Git repository and supports the following clone methods:

| Method | Use Case |
|--------|----------|
| HTTPS Git Clone | General-purpose download for all users |
| SSH Git Clone | Password-free download after SSH key configuration |
| csghub-cli | Suitable for Space repositories containing large files |

## Download via HTTPS

```bash
git clone https://<platform-host>/<namespace>/<space-name>
```

For private Spaces, use an access token:

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<space-name>
```

## Download via SSH

After adding your SSH public key in **User Settings → SSH Keys**:

```bash
git clone ssh://git@<platform-host>/<namespace>/<space-name>
```

## Download via csghub-cli

Install csghub-cli:

```bash
pip install csghub-sdk
```

Download a Space:

```bash
csghub-cli download <namespace>/<space-name> --repo_type space
```

## Download via Python SDK

```python
from pycsghub.snapshot_download import snapshot_download

space_path = snapshot_download(
    repo_id="<namespace>/<space-name>",
    repo_type="space",
    endpoint="https://<platform-host>",
    token="<access-token>"  # Required for private Spaces
)
print(f"Space downloaded to: {space_path}")
```

{{< notice note >}}
Access tokens can be generated in **User Settings → Access Tokens**.
{{</ notice >}}
