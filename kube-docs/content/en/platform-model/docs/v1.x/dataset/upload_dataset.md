---
title: "Upload Datasets"
keywords: "Industry AI Model Platform, upload dataset, Git LFS, csghub-cli, Python SDK"
description: "How to upload dataset files using the Web interface, Git, CLI tools, or Python SDK."
linkTitle: "Upload Datasets"
weight: 2030
---

## Upload Methods

The platform supports four methods for uploading dataset files:

| Method | Use Case |
|--------|----------|
| Web Upload | Quickly upload a single small file (max 5MB per file) |
| Git Upload | General-purpose method for batch and large file uploads |
| csghub-cli | Command-line batch upload with resumable transfers |
| Python SDK | Programmatic upload for automation workflows |

## Prerequisites

- A [dataset repository](./create_dataset) has been created
- An access token has been generated in **User Settings → Access Tokens** (required for Git / CLI / SDK methods)

## Git Upload

### Clone the Dataset Repository

```bash
git lfs install
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<dataset-name>
cd <dataset-name>
```

### Add Files and Push

```bash
# Copy data files into the repository directory
cp /path/to/your/data.parquet .

# Add and commit
git add .
git commit -m "add dataset files"
git push
```

{{< notice note >}}
The platform automatically enables Git LFS tracking based on file extensions. Files with the following extensions are managed via LFS automatically: `.parquet`, `.arrow`, `.csv`, `.jsonl`, `.json`, `.tsv`, `.txt`, `.bin`, `.safetensors`, `.msgpack`, `.h5`, `.hdf5`, `.tflite`, `.tar.gz`, `.zip`, `.zst`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.wav`, `.mp3`, `.flac`, `.mp4`, `.avi`, `.webm`, and others.

To manually track additional formats:

```bash
git lfs track "*.your_extension"
git add .gitattributes
```
{{</ notice >}}

## Web Upload

1. Navigate to the dataset detail page and switch to the **Files** tab
2. Click the **Upload File** button
3. Select the file to upload (max 5MB per file)
4. Enter a commit message and confirm to complete the upload

{{< notice tip >}}
Web upload is best suited for quickly uploading small configuration files or README files. For large data files, use the Git or CLI methods instead.
{{</ notice >}}

## Upload via csghub-cli

Install csghub-cli:

```bash
pip install csghub-sdk
```

Configure the access token:

```bash
export CSG_TOKEN=<access-token>
```

Upload dataset files:

```bash
# Upload a single file
csghub-cli upload <namespace>/<dataset-name> /path/to/data.parquet --repo_type dataset

# Upload an entire directory
csghub-cli upload <namespace>/<dataset-name> /path/to/dataset_dir --repo_type dataset
```

## Upload via Python SDK

```python
from pycsghub.repository import Repository

repo = Repository(
    repo_id="<namespace>/<dataset-name>",
    repo_type="dataset",
    endpoint="https://<platform-host>",
    token="<access-token>"
)

# Clone to local
repo.clone()

# After copying data files into the local repository directory, push to remote
repo.push()
```

{{< notice note >}}
Access tokens can be generated in **User Settings → Access Tokens**. Use a token with write permissions.
{{</ notice >}}

## Related Documentation

- [Create Dataset](./create_dataset)
- [Download Datasets](./download_datasets)
