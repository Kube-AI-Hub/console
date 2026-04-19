---
title: "下载用户空间"
keywords: "行业大模型平台, 下载用户空间, git clone, Space"
description: "介绍如何通过 Git 或命令行工具克隆和下载用户空间仓库。"
linkTitle: "下载用户空间"
weight: 4100
---

## 下载方式概览

用户空间本质上是一个 Git 仓库，支持以下方式克隆：

| 方式 | 适用场景 |
|------|----------|
| HTTPS Git Clone | 通用下载，适合所有用户 |
| SSH Git Clone | 配置 SSH 密钥后免密下载 |
| csghub-cli 命令行 | 适合包含大文件的应用仓库 |

## 使用 HTTPS 下载

```bash
git clone https://<平台地址>/<命名空间>/<应用名称>
```

若需要身份验证（私有应用），使用访问令牌：

```bash
git clone https://<用户名>:<访问令牌>@<平台地址>/<命名空间>/<应用名称>
```

## 使用 SSH 下载

在平台 **个人设置 → SSH 密钥** 中添加您的 SSH 公钥后：

```bash
git clone ssh://git@<平台地址>/<命名空间>/<应用名称>
```

## 使用 csghub-cli 下载

安装 csghub-cli：

```bash
pip install csghub-sdk
```

下载用户空间：

```bash
csghub-cli download <命名空间>/<应用名称> --repo_type space
```

## 使用 Python SDK 下载

```python
from pycsghub.snapshot_download import snapshot_download

space_path = snapshot_download(
    repo_id="<命名空间>/<应用名称>",
    repo_type="space",
    endpoint="https://<平台地址>",
    token="<访问令牌>"  # 私有应用需要
)
print(f"用户空间已下载到: {space_path}")
```

{{< notice note >}}
访问令牌可在平台 **个人设置 → 访问令牌** 中生成。
{{</ notice >}}
