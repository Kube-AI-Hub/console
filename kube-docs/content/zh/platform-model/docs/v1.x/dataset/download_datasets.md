---
title: "下载数据集"
keywords: "行业大模型平台, 下载数据集, git clone, csghub-cli, Python SDK"
description: "介绍如何通过 Git、命令行工具和 Python SDK 下载数据集。"
linkTitle: "下载数据集"
weight: 2100
---

## 下载方式概览

平台支持以下三种方式下载数据集：

| 方式 | 适用场景 |
|------|----------|
| HTTPS Git Clone | 通用下载，适合所有用户 |
| SSH Git Clone | 配置 SSH 密钥后免密下载 |
| csghub-cli 命令行 | 支持断点续传，适合大型数据集下载 |

## 前置条件

下载包含大文件的数据集前，需要安装 Git LFS：

```bash
# 安装 Git LFS（macOS）
brew install git-lfs

# 安装 Git LFS（Ubuntu/Debian）
sudo apt-get install git-lfs

# 初始化 Git LFS
git lfs install
```

## 使用 HTTPS 下载

```bash
# 克隆数据集仓库
git lfs install
git clone https://<平台地址>/<命名空间>/<数据集名称>
```

若需要身份验证（私有数据集），使用访问令牌：

```bash
git clone https://<用户名>:<访问令牌>@<平台地址>/<命名空间>/<数据集名称>
```

如需跳过大文件下载：

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://<平台地址>/<命名空间>/<数据集名称>
```

## 使用 SSH 下载

在平台 **个人设置 → SSH 密钥** 中添加您的 SSH 公钥后：

```bash
git lfs install
git clone ssh://git@<平台地址>/<命名空间>/<数据集名称>
```

## 使用 csghub-cli 下载

安装 csghub-cli：

```bash
pip install csghub-sdk
```

下载数据集：

```bash
# 下载整个数据集仓库
csghub-cli download <命名空间>/<数据集名称> --repo_type dataset

# 下载指定版本
csghub-cli download <命名空间>/<数据集名称> --repo_type dataset --revision main
```

## 使用 Python SDK 下载

```python
from pycsghub.snapshot_download import snapshot_download

# 下载数据集到本地缓存目录
dataset_path = snapshot_download(
    repo_id="<命名空间>/<数据集名称>",
    repo_type="dataset",
    endpoint="https://<平台地址>",
    token="<访问令牌>"  # 私有数据集需要
)
print(f"数据集已下载到: {dataset_path}")
```

{{< notice note >}}
访问令牌可在平台 **个人设置 → 访问令牌** 中生成。
{{</ notice >}}
