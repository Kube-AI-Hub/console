# 项目成员列表（L3）

[子模块需求](./_index.md)

## 概述

项目成员表：用户名、状态、角色、最近活动。

## 用户故事

### US1 - 看清谁在这个项目里、是什么角色 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到每个成员的角色与状态**，以便 **确认访问范围**。

**Independent Test**：打开成员列表，核对列与某个成员的 `iam.kubesphere.io/role` 注解一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01** — 已知项目内有成员，当打开成员列表，则显示名称、状态、角色、最近活动四列。

## 设计目标

把注解里的角色与状态变成可读列。

## 约束与边界

- 角色取 `iam.kubesphere.io/role` 注解。
- 「最近活动」取 `iam.kubesphere.io/last-password-change-time`（接口没有登录时间）。

## UI 交互设计

单行用户名；状态徽章（活跃/未激活）。

## 文案与校验

- 列：名称、状态、角色、最近活动。
- 状态：活跃 / 未激活。

## 边界情况

- 没有成员时显示空态且不渲染表头。
- 角色注解缺失时显示 `-`。

## 明确不做

- 邀请成员、修改角色、移出项目。

## 假设

- IAM 的 members 投影带角色注解。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01** — 列表展示名称、状态、角色、最近活动。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01** — 角色列与注解一致。
