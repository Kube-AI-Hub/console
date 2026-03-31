---
title: "上传数据集"
keywords: "行业大模型平台, 上传数据集, Git LFS, csghub-cli, Python SDK"
description: "介绍通过 Web 界面、Git、命令行工具和 Python SDK 四种方式上传数据集文件。"
linkTitle: "上传数据集"
weight: 2030
---

## 上传方式概览

平台支持以下四种方式上传数据集文件：

| 方式 | 适用场景 |
|------|----------|
| Web 上传 | 快速上传单个小文件（单文件不超过 5MB） |
| Git 上传 | 通用方式，适合批量上传和大文件上传 |
| csghub-cli 命令行 | 命令行批量上传，支持断点续传 |
| Python SDK | 通过代码集成上传，适合自动化流程 |

## 前置条件

- 已 [创建数据集](./create_dataset) 仓库
- 已在平台 **个人设置 → 访问令牌** 中生成访问令牌（Git / CLI / SDK 方式需要）

## Git 上传

### 克隆数据集仓库

```bash
git lfs install
git clone https://<用户名>:<访问令牌>@<平台地址>/<命名空间>/<数据集名称>
cd <数据集名称>
```

### 添加文件并推送

```bash
# 将数据文件复制到仓库目录
cp /path/to/your/data.parquet .

# 添加并提交
git add .
git commit -m "add dataset files"
git push
```

{{< notice note >}}
平台会根据文件扩展名自动启用 Git LFS 追踪。以下扩展名的文件将自动通过 LFS 管理：`.parquet`、`.arrow`、`.csv`、`.jsonl`、`.json`、`.tsv`、`.txt`、`.bin`、`.safetensors`、`.msgpack`、`.h5`、`.hdf5`、`.tflite`、`.tar.gz`、`.zip`、`.zst`、`.png`、`.jpg`、`.jpeg`、`.gif`、`.bmp`、`.wav`、`.mp3`、`.flac`、`.mp4`、`.avi`、`.webm` 等。

如需手动追踪其他格式，可执行：

```bash
git lfs track "*.your_extension"
git add .gitattributes
```
{{</ notice >}}

## Web 上传

1. 进入数据集详情页，切换到 **文件** 标签页
2. 点击 **上传文件** 按钮
3. 选择要上传的文件（单个文件大小不超过 5MB）
4. 填写提交信息，点击确认完成上传

{{< notice tip >}}
Web 上传适合快速上传小型配置文件或 README。对于大型数据文件，建议使用 Git 或 CLI 方式上传。
{{</ notice >}}

## 使用 csghub-cli 上传

安装 csghub-cli：

```bash
pip install csghub-sdk
```

配置访问令牌：

```bash
export CSG_TOKEN=<访问令牌>
```

上传数据集文件：

```bash
# 上传单个文件
csghub-cli upload <命名空间>/<数据集名称> /path/to/data.parquet --repo_type dataset

# 上传整个目录
csghub-cli upload <命名空间>/<数据集名称> /path/to/dataset_dir --repo_type dataset
```

## 使用 Python SDK 上传

```python
from pycsghub.repository import Repository

# 初始化仓库
repo = Repository(
    repo_id="<命名空间>/<数据集名称>",
    repo_type="dataset",
    endpoint="https://<平台地址>",
    token="<访问令牌>"
)

# 克隆到本地
repo.clone()

# 将数据文件复制到本地仓库目录后，推送到远端
repo.push()
```

{{< notice note >}}
访问令牌可在平台 **个人设置 → 访问令牌** 中生成。建议使用具有写权限的令牌。
{{</ notice >}}

## 相关文档

- [创建数据集](./create_dataset)
- [下载数据集](./download_datasets)
