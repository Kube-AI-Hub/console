---
title: "Download Models"
keywords: "Industry AI Model Platform, download model, git clone, csghub-cli, Python SDK"
description: "How to download model files from the Model Hub using Git, CLI tools, or Python SDK."
linkTitle: "Download Models"
weight: 1100
---

## Download Methods

The platform supports three methods to download model files:

| Method | Use Case |
|--------|----------|
| HTTPS Git Clone | General-purpose download for all users |
| SSH Git Clone | Password-free download after SSH key configuration |
| csghub-cli | Supports resumable downloads; ideal for large models |

## Prerequisites

Before downloading model repositories containing large files (e.g., `.safetensors`, `.bin`), install Git LFS:

```bash
# Install Git LFS (macOS)
brew install git-lfs

# Install Git LFS (Ubuntu/Debian)
sudo apt-get install git-lfs

# Initialize Git LFS
git lfs install
```

## Download via HTTPS

```bash
# Clone the model repository (LFS files are downloaded automatically)
git lfs install
git clone https://<platform-host>/<namespace>/<model-name>
```

For private models, use an access token as credentials:

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<model-name>
```

To skip large file downloads and only get the repository structure:

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://<platform-host>/<namespace>/<model-name>
```

## Download via SSH

After adding your SSH public key in **User Settings → SSH Keys**:

```bash
git lfs install
git clone ssh://git@<platform-host>/<namespace>/<model-name>
```

## Download via csghub-cli

Install csghub-cli:

```bash
pip install csghub-sdk
```

Download a model:

```bash
# Download the entire model repository
csghub-cli download <namespace>/<model-name> --repo_type model

# Download a specific branch or revision
csghub-cli download <namespace>/<model-name> --repo_type model --revision main
```

## Download via Python SDK

```python
from pycsghub.snapshot_download import snapshot_download

model_path = snapshot_download(
    repo_id="<namespace>/<model-name>",
    repo_type="model",
    endpoint="https://<platform-host>",
    token="<access-token>"  # Required for private models
)
print(f"Model downloaded to: {model_path}")
```

{{< notice note >}}
Access tokens can be generated in **User Settings → Access Tokens**.
{{</ notice >}}
