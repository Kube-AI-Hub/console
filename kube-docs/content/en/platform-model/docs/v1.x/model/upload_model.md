---
title: "Upload Models"
keywords: "Industry AI Model Platform, upload model, Git LFS, csghub-cli, Python SDK"
description: "How to upload model files to a model repository via the Web interface, Git, CLI tools, or Python SDK."
linkTitle: "Upload Models"
weight: 1030
---

## Upload Methods Overview

The platform supports four methods for uploading model files:

| Method | Best For |
|--------|----------|
| Web Upload | Small files under 5MB per file |
| Git Upload | Version-controlled code and config files, with Git LFS for large files |
| CLI (csghub-cli) | Very large files (over 5GB) with resumable uploads |
| Python SDK (pycsghub) | Programmatic batch uploads |

## Web Upload

1. Navigate to the **Files** tab of the model repository.
2. Click the **Add File** button.
3. Select local files to upload (individual file size limited to 5MB).
4. Enter a commit message and confirm the submission.

{{< notice note >}}
The Web interface is suitable for uploading configuration files, READMEs, and other small files. For large model weight files, use Git LFS, csghub-cli, or the SDK.
{{</ notice >}}

## Git Upload

### Prerequisites

Before uploading model repositories containing large files (e.g., `.safetensors`, `.bin`), install Git LFS:

```bash
# Install Git LFS (macOS)
brew install git-lfs

# Install Git LFS (Ubuntu/Debian)
sudo apt-get install git-lfs

# Initialize Git LFS
git lfs install
```

### Clone and Upload

```bash
# Clone the model repository
git clone https://<platform-host>/<namespace>/<model-name>
cd <model-name>

# Copy model files into the repository directory
cp /path/to/your/model-files/* .

# Add, commit, and push
git add .
git commit -m "Upload model files"
git push
```

For authentication, use an access token:

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<model-name>
```

### Automatic Git LFS Tracking

The platform automatically configures Git LFS tracking rules for common model file extensions, so you do not need to manually run `git lfs track`:

| File Extension | Description |
|---------------|-------------|
| `.safetensors` | SafeTensors format weight files |
| `.bin` | PyTorch binary weight files |
| `.pt` | PyTorch model files |
| `.pth` | PyTorch checkpoint files |
| `.onnx` | ONNX format model files |
| `.gguf` | GGUF format model files (llama.cpp) |
| `.ggml` | GGML format model files |
| `.h5` | HDF5 format weight files (Keras/TensorFlow) |
| `.msgpack` | MessagePack format model files |
| `.zip` | Compressed archive files |
| `.tar.gz` | Compressed archive files |

To track additional file types, add them manually:

```bash
git lfs track "*.custom_ext"
git add .gitattributes
```

## CLI Upload (csghub-cli)

csghub-cli is ideal for uploading very large files with resumable upload support.

### Installation

```bash
pip install csghub-sdk
```

### Upload a Large Folder

```bash
csghub-cli upload <namespace>/<model-name> /path/to/local/folder \
  -e https://<platform-host> \
  -t <access-token>
```

### Upload a Single File

```bash
csghub-cli upload <namespace>/<model-name> /path/to/model.safetensors \
  -e https://<platform-host> \
  -t <access-token>
```

## Python SDK Upload (pycsghub)

Use the `Repository` class from pycsghub to upload model files programmatically.

### Installation

```bash
pip install pycsghub
```

### Upload Example

```python
from pycsghub.repo_reader import AutoModelForCausalLM

token = "<access-token>"
endpoint = "https://<platform-host>"
repo_id = "<namespace>/<model-name>"

from pycsghub.repository import Repository

repo = Repository(
    repo_id=repo_id,
    repo_type="model",
    token=token,
    endpoint=endpoint
)

# Upload a local directory to the repository
repo.upload_folder(
    folder_path="/path/to/local/model",
    commit_message="Upload model files via SDK"
)
```

## View Commit History

After uploading, you can view the file commit history in the **Commits** tab of the model repository, including the timestamp, author, and list of changed files for each commit.

{{< notice note >}}
Access tokens can be generated in **User Settings → Access Tokens**. It is recommended to create separate tokens for different purposes and keep them secure.
{{</ notice >}}
