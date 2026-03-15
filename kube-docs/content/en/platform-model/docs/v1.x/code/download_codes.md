---
title: "Download Code Repositories"
keywords: "Industry AI Model Platform, download code, git clone, csghub-cli"
description: "How to clone and download code repositories using Git or CLI tools."
linkTitle: "Download Code Repositories"
weight: 3100
---

## Download Methods

The platform supports the following methods to clone and download code repositories:

| Method | Use Case |
|--------|----------|
| HTTPS Git Clone | General-purpose download for all users |
| SSH Git Clone | Password-free download after SSH key configuration |
| csghub-cli | Suitable for repositories containing large files |

## Download via HTTPS

```bash
git clone https://<platform-host>/<namespace>/<repo-name>
```

For private repositories, use an access token:

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<repo-name>
```

## Download via SSH

After adding your SSH public key in **User Settings → SSH Keys**:

```bash
git clone ssh://git@<platform-host>/<namespace>/<repo-name>
```

## Download via csghub-cli

Install csghub-cli:

```bash
pip install csghub-sdk
```

Download a code repository:

```bash
csghub-cli download <namespace>/<repo-name> --repo_type code
```

## Download via Python SDK

```python
from pycsghub.snapshot_download import snapshot_download

repo_path = snapshot_download(
    repo_id="<namespace>/<repo-name>",
    repo_type="code",
    endpoint="https://<platform-host>",
    token="<access-token>"  # Required for private repositories
)
print(f"Repository downloaded to: {repo_path}")
```

{{< notice note >}}
Access tokens can be generated in **User Settings → Access Tokens**.
{{</ notice >}}
