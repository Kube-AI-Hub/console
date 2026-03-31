---
title: "上传模型"
keywords: "行业大模型平台, 上传模型, Git LFS, csghub-cli, Python SDK"
description: "介绍如何通过 Web 界面、Git、命令行工具和 Python SDK 上传模型文件到模型仓库。"
linkTitle: "上传模型"
weight: 1030
---

## 上传方式概览

平台支持以下四种方式上传模型文件：

| 方式 | 适用场景 |
|------|----------|
| Web 界面上传 | 适合上传小文件（单个文件不超过 5MB） |
| Git 上传 | 适合版本化管理代码和配置文件，支持 Git LFS 大文件 |
| 命令行工具（csghub-cli） | 适合上传超大文件（超过 5GB），支持断点续传 |
| Python SDK（pycsghub） | 适合通过编程方式批量上传文件 |

## Web 界面上传

1. 进入模型仓库的 **文件** 标签页。
2. 点击 **添加文件** 按钮。
3. 选择本地文件上传（单个文件大小限制为 5MB）。
4. 输入提交信息并确认提交。

{{< notice note >}}
Web 界面适合上传配置文件、README 等小文件。如需上传模型权重文件等大文件，请使用 Git LFS、csghub-cli 或 SDK 方式。
{{</ notice >}}

## Git 上传

### 前置条件

上传包含大文件（如 `.safetensors`、`.bin`）的模型仓库前，需要安装 Git LFS：

```bash
# 安装 Git LFS（macOS）
brew install git-lfs

# 安装 Git LFS（Ubuntu/Debian）
sudo apt-get install git-lfs

# 初始化 Git LFS
git lfs install
```

### 克隆并上传

```bash
# 克隆模型仓库
git clone https://<平台地址>/<命名空间>/<模型名称>
cd <模型名称>

# 将模型文件复制到仓库目录
cp /path/to/your/model-files/* .

# 添加、提交并推送
git add .
git commit -m "上传模型文件"
git push
```

如需身份验证，使用访问令牌：

```bash
git clone https://<用户名>:<访问令牌>@<平台地址>/<命名空间>/<模型名称>
```

### Git LFS 自动追踪

平台会自动为以下常见模型文件扩展名配置 Git LFS 追踪规则，无需手动执行 `git lfs track`：

| 文件扩展名 | 说明 |
|-----------|------|
| `.safetensors` | SafeTensors 格式权重文件 |
| `.bin` | PyTorch 二进制权重文件 |
| `.pt` | PyTorch 模型文件 |
| `.pth` | PyTorch 检查点文件 |
| `.onnx` | ONNX 格式模型文件 |
| `.gguf` | GGUF 格式模型文件（llama.cpp） |
| `.ggml` | GGML 格式模型文件 |
| `.h5` | HDF5 格式权重文件（Keras/TensorFlow） |
| `.msgpack` | MessagePack 格式模型文件 |
| `.zip` | 压缩归档文件 |
| `.tar.gz` | 压缩归档文件 |

如需追踪其他文件类型，可以手动添加：

```bash
git lfs track "*.custom_ext"
git add .gitattributes
```

## 命令行工具上传（csghub-cli）

csghub-cli 适合上传超大文件，支持断点续传功能。

### 安装

```bash
pip install csghub-sdk
```

### 上传大文件夹

```bash
csghub-cli upload <命名空间>/<模型名称> /path/to/local/folder \
  -e https://<平台地址> \
  -t <访问令牌>
```

### 上传单个文件

```bash
csghub-cli upload <命名空间>/<模型名称> /path/to/model.safetensors \
  -e https://<平台地址> \
  -t <访问令牌>
```

## Python SDK 上传（pycsghub）

使用 pycsghub 的 `Repository` 类可以通过编程方式上传模型文件。

### 安装

```bash
pip install pycsghub
```

### 上传示例

```python
from pycsghub.repo_reader import AutoModelForCausalLM

# 设置参数
token = "<访问令牌>"
endpoint = "https://<平台地址>"
repo_id = "<命名空间>/<模型名称>"

# 上传文件到模型仓库
from pycsghub.repository import Repository

repo = Repository(
    repo_id=repo_id,
    repo_type="model",
    token=token,
    endpoint=endpoint
)

# 上传本地目录到仓库
repo.upload_folder(
    folder_path="/path/to/local/model",
    commit_message="通过 SDK 上传模型文件"
)
```

## 查看提交历史

上传完成后，可以在模型仓库的 **提交记录** 标签页中查看文件的提交历史，包括每次提交的时间、提交者和变更文件列表。

{{< notice note >}}
访问令牌可在平台 **个人设置 → 访问令牌** 中生成。建议为不同用途创建不同的令牌，并妥善保管。
{{</ notice >}}
