---
title: "下载代码仓库"
keywords: "行业大模型平台, 下载代码, git clone, csghub-cli"
description: "介绍如何通过 Git 或命令行工具克隆和下载代码仓库。"
linkTitle: "下载代码仓库"
weight: 3100
---

## 下载方式概览

平台支持以下方式克隆和下载代码仓库：

| 方式 | 适用场景 |
|------|----------|
| HTTPS Git Clone | 通用下载，适合所有用户 |
| SSH Git Clone | 配置 SSH 密钥后免密下载 |
| csghub-cli 命令行 | 适合包含大文件的代码仓库 |

## 使用 HTTPS 下载

```bash
git clone https://<平台地址>/<命名空间>/<仓库名称>
```

若需要身份验证（私有仓库），使用访问令牌：

```bash
git clone https://<用户名>:<访问令牌>@<平台地址>/<命名空间>/<仓库名称>
```

## 使用 SSH 下载

在平台 **个人设置 → SSH 密钥** 中添加您的 SSH 公钥后：

```bash
git clone ssh://git@<平台地址>/<命名空间>/<仓库名称>
```

## 使用 csghub-cli 下载

安装 csghub-cli：

```bash
pip install csghub-sdk
```

下载代码仓库：

```bash
csghub-cli download <命名空间>/<仓库名称> --repo_type code
```

## 使用 Python SDK 下载

```python
from pycsghub.snapshot_download import snapshot_download

repo_path = snapshot_download(
    repo_id="<命名空间>/<仓库名称>",
    repo_type="code",
    endpoint="https://<平台地址>",
    token="<访问令牌>"  # 私有仓库需要
)
print(f"代码仓库已下载到: {repo_path}")
```

{{< notice note >}}
访问令牌可在平台 **个人设置 → 访问令牌** 中生成。
{{</ notice >}}
