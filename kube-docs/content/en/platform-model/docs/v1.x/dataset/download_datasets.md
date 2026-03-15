---
title: "Download Datasets"
keywords: "Industry AI Model Platform, download dataset, git clone, csghub-cli, Python SDK"
description: "How to download datasets using Git, CLI tools, or Python SDK."
linkTitle: "Download Datasets"
weight: 2100
---

## Download Methods

The platform supports three methods to download datasets:

| Method | Use Case |
|--------|----------|
| HTTPS Git Clone | General-purpose download for all users |
| SSH Git Clone | Password-free download after SSH key configuration |
| csghub-cli | Supports resumable downloads; ideal for large datasets |

## Prerequisites

Before downloading datasets containing large files, install Git LFS:

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
# Clone the dataset repository
git lfs install
git clone https://<platform-host>/<namespace>/<dataset-name>
```

For private datasets, use an access token:

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<dataset-name>
```

To skip large file downloads:

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://<platform-host>/<namespace>/<dataset-name>
```

## Download via SSH

After adding your SSH public key in **User Settings → SSH Keys**:

```bash
git lfs install
git clone ssh://git@<platform-host>/<namespace>/<dataset-name>
```

## Download via csghub-cli

Install csghub-cli:

```bash
pip install csghub-sdk
```

Download a dataset:

```bash
# Download the entire dataset repository
csghub-cli download <namespace>/<dataset-name> --repo_type dataset

# Download a specific revision
csghub-cli download <namespace>/<dataset-name> --repo_type dataset --revision main
```

## Download via Python SDK

```python
from pycsghub.snapshot_download import snapshot_download

dataset_path = snapshot_download(
    repo_id="<namespace>/<dataset-name>",
    repo_type="dataset",
    endpoint="https://<platform-host>",
    token="<access-token>"  # Required for private datasets
)
print(f"Dataset downloaded to: {dataset_path}")
```

{{< notice note >}}
Access tokens can be generated in **User Settings → Access Tokens**.
{{</ notice >}}
