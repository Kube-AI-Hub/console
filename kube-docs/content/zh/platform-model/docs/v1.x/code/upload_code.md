---
title: "上传代码仓库"
keywords: "行业大模型平台, 上传代码, Git 上传, Web 上传, Git LFS"
description: "介绍如何通过 Web 页面或 Git 命令上传代码文件到平台代码仓库。"
linkTitle: "上传代码仓库"
weight: 3030
---

## 上传方式概览

平台支持以下两种方式上传代码文件：

| 方式 | 适用场景 |
|------|----------|
| Web 页面上传 | 单次上传少量小文件（单文件不超过 5 MB，最多 5 个文件） |
| Git 命令上传 | 适用于批量上传或文件较大的场景 |

## Web 页面上传

1. 进入代码仓库详情页，点击 **文件** 标签页。
2. 点击 **上传文件** 按钮。
3. 拖拽或选择需要上传的文件（单文件大小不超过 5 MB，最多 5 个文件）。
4. 填写提交信息（最多 200 个字符）和可选的提交描述。
5. 确认分支为 `main`，点击 **提交** 完成上传。

## Git 命令上传

对于较大的项目或需要批量上传的场景，推荐使用 Git 命令行。

### 克隆仓库

```bash
git clone https://<platform-host>/<namespace>/<code-repo-name>
```

如果是私有仓库，需要使用访问令牌：

```bash
git clone https://<username>:<access-token>@<platform-host>/<namespace>/<code-repo-name>
```

### 添加并提交文件

将代码文件复制到仓库目录后，执行以下命令：

```bash
cd <code-repo-name>
git add .
git commit -m "Initial commit"
git push origin main
```

{{< notice note >}}
如果仓库中包含大文件（如模型权重、数据集等），建议使用 Git LFS（Large File Storage）管理。先安装 Git LFS 并追踪大文件类型：

```bash
git lfs install
git lfs track "*.bin"
git lfs track "*.h5"
git add .gitattributes
git add .
git commit -m "Add large files with LFS"
git push origin main
```
{{</ notice >}}

## 相关文档

- [创建代码仓库](./create_code)
- [更新代码仓库](./update_code)
- [下载代码仓库](./download_codes)
