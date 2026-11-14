# 企业空间控制台（L3）

[子模块需求](./_index.md)

## 概述

企业空间自己的控制台：`/kube-frontend/workspaces/<ws>/…` 下的**概览、项目、企业空间成员**三页。

老 console 里 `/workspaces/:ws/*` 是独立作用域（18 条路由）：在企业空间之上是平台，之下是项目。新 UI 此前只有平台侧 `访问控制 › 企业空间 › 详情` 的只读副本——那回答的是「这个企业空间是什么」，而不是「里面有什么」。

## 用户故事

### US1 - 企业空间管理员看自己的空间 (Priority: P1)

作为 **企业空间管理员**，我希望 **在一个地方看到这个空间的概览、项目和成员**，以便 **不必绕到平台访问控制里逐项查**。

**Independent Test**：打开 `/workspaces/<ws>/overview`，核对标题是空间别名或名称、项目数与成员数与接口一致；侧栏出现「概览 / 项目 / 企业空间成员」三项。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01** — 已知企业空间有 N 个项目与 M 个成员，当打开该空间控制台概览页，则显示基本信息（名称/别名/管理员/创建者/创建时间/部署集群）与项目数 N、成员数 M；侧栏有「概览 / 项目 / 企业空间成员」；项目页列出 N 行且名称链到该项目控制台（URL 含 workspace、cluster、project 段）；成员页列出 M 行，含成员名与角色。

## 设计目标

1. 企业空间成为**独立作用域**：URL 与侧栏都与项目作用域分开。
2. 三页都直接读同一套 workspace API，不复制平台详情页的数据口径。

## 约束与边界

- 本规格覆盖只读概览；成员写入由 [workspace-members.md](./workspace-members.md) 承接，配额及角色另立规格。
- 项目链接需要 cluster 段：取 `spec.placement.clusters[0]`，缺省回落 `host`。

## UI 交互设计

- 侧栏（该作用域）：概览 / 项目 / 企业空间成员。
- 概览：基本信息表格 + 两张计数卡片（项目、成员），各自带进入链接。
- 项目页：名称（链接）/ 项目名 / 状态 / 创建者 / 创建时间。
- 成员页：成员 / 角色 / 状态 / 最近登录。

## 文案与校验

- 空态：没有项目 / 没有成员。
- 空值 `-`。

## 边界情况

- 空间别名未设置：标题回落为空间名。
- 成员角色缺失：显示 `-`（绑定异常而不是把成员藏起来）。

## 明确不做

- 邀请/移除成员不属于本只读规格，已由 [workspace-members.md](./workspace-members.md) 使用空间角色列表承接。
- 配额与部门：需配额接口与组织模型，另立。
- DevOps / 联邦项目 / 应用商店：整块模块未部署（见缺口分析 §3.2）。

## 假设

- `workspacemembers` 聚合接口是该部署上的成员来源（tenant 路径 404）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01** — 企业空间独立作用域与三页导航。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02** — 项目行链到项目控制台并带三段落。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01** — 计数与接口一致；侧栏三项可达；链接段正确。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01`
