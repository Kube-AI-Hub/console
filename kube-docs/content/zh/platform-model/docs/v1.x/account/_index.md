---
title: "账号设置"
keywords: "行业大模型平台, 账号设置, 访问令牌, API Key, SSH 公钥, 个人资料"
description: "账号设置维护登录身份与访问凭据：个人资料、访问令牌、平台 API Key 与 SSH 公钥。"
linkTitle: "账号设置"
weight: 8100
icon: "/images/docs/platform-model/account.svg"
---

## 概览

账号设置维护**登录身份与访问凭据**。推理 API 调用、Git 克隆、开发实例免密登录都依赖这里。

侧栏四项相互独立，改一项不影响其它项已经发出的凭据：

| 菜单项 | 路径 | 用途 |
|--------|------|------|
| 个人资料 | `/settings/profile` | 改昵称、邮箱、头像等基础信息 |
| 访问令牌 | `/settings/access-token` | 调用平台 API、SDK 与命令行工具 |
| API Keys | `/settings/api-keys` | 供自动化与第三方系统调用 |
| SSH 公钥 | `/settings/ssh-keys` | Git 免密克隆、开发实例免密登录 |

入口：点右上角头像，在下拉菜单选择 **账号设置**。

## 个人资料

修改昵称、邮箱与头像等基础信息。邮箱格式与用户名规则在保存时校验，不通过就地提示。

修改资料**不会影响**已经发出的访问令牌、API Key 与 SSH 公钥。

## 访问令牌

访问令牌用于：

- 调用平台的推理 API（私有推理实例需要鉴权）。
- 用 `csghub-cli`、Python SDK 或 Git 命令行访问仓库。
- 在脚本与 CI 里代表当前用户操作。

创建后**明文只展示一次**，关闭页面后只保留列表与吊销操作。请立刻复制并妥善保存。

## API Keys

平台 API Key 供**自动化与第三方系统**代表你调用平台接口。

与访问令牌一样，明文只展示一次；列表里可以查看已有 Key 并吊销不再使用的。

## SSH 公钥

把本机的 SSH 公钥登记到平台，之后可以：

- 用 `git clone git@...` 免密克隆模型、数据集、代码等仓库。
- 免密登录开发实例（Notebook）。

生成方式（本机执行）：

```
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
```

把输出的公钥粘贴到页面保存即可。私钥不要上传。

## 相关操作

- [个人主页](../profile/)
- [组织](../orgs/)
- [下载模型](../model/download_models)
- [开发环境](../inferencefinetune/notebook/notebook_intro)
