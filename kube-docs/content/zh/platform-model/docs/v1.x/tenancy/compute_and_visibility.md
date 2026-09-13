---
title: "算力项目与可见性"
keywords: "行业大模型平台, 算力项目, 配额, 公开推理, 访问令牌"
description: "创建实例时选择算力项目；门户谁能看见入口，和推理 API 要不要访问令牌，是两件事。"
linkTitle: "算力项目与可见性"
weight: 530
---

## 算力项目

创建推理实例、微调、开发实例、评测任务和用户空间时，表单有 **算力项目**，与区域、算力规格并列。

| 当前租户 | 下拉里有什么 |
|----------|----------------|
| 公共租户 | 只有 **space**（命名空间 `spaces`） |
| 企业租户 | 当前用户有权限的项目（Kubernetes 命名空间） |

实例放到所选项目的命名空间，吃该命名空间的 ResourceQuota。实例挂项目，不挂组织。

管理后台 **算力资源概览** 汇总当前租户下这些项目的配额和已用，**不是**整集群节点库存。不要把概览理解成「集群还剩多少核」。规格表、运行时框架仍是平台共享目录，不按租户切换。

{{< notice note >}}
Notebook 和微调没有公开 / 私有开关，默认私有。项目普通成员不能进他人的开发环境。
{{</ notice >}}

## 门户可见性和推理 API

把两件「公开」分开：

| | 门户列表 | 推理 API（`/endpoint`） |
|--|----------|-------------------------|
| **公开** | 该算力项目的成员能看见入口 | 不需要访问令牌，匿名可调用 |
| **私有** | 仅创建者看见；项目管理员可停删以回收额度 | 需要有效访问令牌；令牌不按项目校验 |

未加入该项目的用户，即使猜到 URL，在门户里也看不到入口；但公开推理 URL 仍可被外部调用。不要把「门户看不见」理解成「禁止匿名调 API」。

调用私有实例仍在请求头携带访问令牌，步骤见 [使用推理实例](../inferencefinetune/inference/endpoint_usage)。

## 相关文档

- [创建推理实例](../inferencefinetune/inference/endpoint_create)
- [创建微调实例](../inferencefinetune/finetune/finetune_create)
- [创建开发实例](../inferencefinetune/notebook/notebook_create)
- [公共推理服务](/docs/v3.4/access-control-and-account-management/public-inference/)
