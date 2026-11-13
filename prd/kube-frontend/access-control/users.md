# 用户列表（L3）

[子模块需求](./_index.md)

## 概述

平台用户列表：用户名（副行邮箱）、状态、平台角色、最近登录。

## 用户故事

### US1 - 看清谁在平台上、是什么角色 (Priority: P1)

作为 **平台管理员**，我希望 **在列表上看到状态与平台角色**，以便 **确认访问范围**。

**Independent Test**：打开用户页，核对四列与某个用户的平台角色注解一致。

### US2 - 停用、启用与删除账号 (Priority: P1)

作为 **平台管理员**，我希望 **停用不再使用的账号或直接删除**，以便 **不让离职账号继续持有凭据**。

**Independent Test**：创建一个临时用户 → 停用 → 回读 Disabled → 启用 → 回读 Active → 删除 → 列表不再包含。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03** — 已知用户列表有数据，当行操作「修改平台角色」并选择平台管理员，则 `iam.kubesphere.io/platform-role` 变为 `platform-admin`；当「删除」并确认，则该用户不再出现在列表结果中。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02** — 已知在用户页，当点「创建」填写用户名、邮箱、密码与平台角色并确认，则用户被创建且 `iam.kubesphere.io/platform-role` 注解等于所选角色；用户名非法或密码弱于规则时提交被拦下并给出提示。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 已知平台上有用户，当打开用户页，则显示用户名、状态、平台角色、最近登录四列。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04** — 已知用户列表有数据，当点击名称列排序，则顺序变为升序；再次点击，则变为降序（两次结果不同）。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05** — 已知平台上有非 admin 用户，当对其执行「停用」，则该用户 `status.state` 变为 `Disabled`，行操作变为「启用」；执行「启用」后回到 `Active`；执行「删除」并确认后该用户从列表中消失；admin 账号不提供「停用」与「删除」。

## 设计目标

把平台角色与状态变成可读列。

## 约束与边界

- 读 IAM 组 `users`；平台角色取 `iam.kubesphere.io/platform-role` 或 `iam.kubesphere.io/globalrole`。

## UI 交互设计

状态徽章：活跃为成功色。

## 文案与校验

- 列：用户名、状态、平台角色、最近登录。
- 状态：活跃 / 已停用。

## 边界情况

- 用户对象没有 `status` 时按活跃处理（平台没有声明停用）。
- 没有登录记录时显示 `-`。

## 明确不做

- 停用/启用用户（平台侧接口未验证）。
- 创建、改角色、删除已迁移。

## 假设

- IAM 按 `page`/`limit` 分页。

## 验收用例

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 列表展示四列。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 平台角色列与注解一致。
