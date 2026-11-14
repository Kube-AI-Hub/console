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

### US3 - 修正账号的邮箱与描述 (Priority: P2)

作为 **平台管理员**，我希望 **改掉用户的邮箱与描述**，以便 **账号信息与本人对得上**。

**Independent Test**：创建临时用户 → 编辑邮箱与描述 → 回读两个字段 → 删除。

### US4 - 批量停用/启用账号 (Priority: P2)

作为 **平台管理员**，我希望 **一次停用多个离职账号**，以便 **不必逐个打开行菜单**。

**Independent Test**：创建两个临时用户 → 勾选两者 → 停用 → 回读均为 Disabled → 启用 → 均 Active。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03** — 已知用户列表有数据，当行操作「修改平台角色」并选择平台管理员，则 `iam.kubesphere.io/platform-role` 变为 `platform-admin`；当「删除」并确认，则该用户不再出现在列表结果中。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02** — 已知在用户页，当点「创建」填写用户名、邮箱、密码与平台角色并确认，则用户被创建且 `iam.kubesphere.io/platform-role` 注解等于所选角色；用户名非法或密码弱于规则时提交被拦下并给出提示；密码输入过程中，字段下方显示强度面板（四条检查项与弱/中/强三档），随输入实时变化。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 已知平台上有用户，当打开用户页，则显示用户名、状态、平台角色、最近登录四列。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04** — 已知用户列表有数据，当点击名称列排序，则顺序变为升序；再次点击，则变为降序（两次结果不同）。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05** — 已知平台上有非 admin 用户，当对其执行「停用」，则该用户 `status.state` 变为 `Disabled`，行操作变为「启用」；执行「启用」后回到 `Active`；执行「删除」并确认后该用户从列表中消失；admin 账号不提供「停用」与「删除」。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06** — 已知平台上有用户，当对某人执行「编辑信息」并填写新的邮箱与描述后保存，则该用户的 `spec.email` 变为新邮箱、`kubesphere.io/description` 注解变为新描述；邮箱非法时提交被拦下并提示。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07** — 已知用户列表有多个非 admin 用户，当勾选其中两个并点「停用」，则这两个账号的 `status.state` 均变为 `Disabled`；再勾选并点「启用」，两者均回到 `Active`；admin 行没有复选框（不可被选中）。

## 设计目标

把平台角色与状态变成可读列。

## 约束与边界

- 读 IAM 组 `users`；平台角色取 `iam.kubesphere.io/platform-role` 或 `iam.kubesphere.io/globalrole`。

## UI 交互设计

状态徽章：活跃为成功色。

创建用户弹窗的密码字段带强度面板（与个人设置同一个组件）：密码为空时不渲染；输入后显示四条检查项
（大写与小写字母 / 数字 / 特殊字符 / 8–64 位）与弱/中/强三档。句柄：`users:password-strength`（带
`data-strength`）、`users:password-strength-bar`、`users:password-check-{case,digit,special,length}`（带
`data-met`）；输入框仍是 `#ai-field-password`。面板的 `scope` 是 `users`，个人设置是 `user-settings`，
两处句柄不串台。

## 文案与校验

- 列：用户名、状态、平台角色、最近登录。
- 状态：活跃 / 已停用。

## 边界情况

- 用户对象没有 `status` 时按活跃处理（平台没有声明停用）。
- 没有登录记录时显示 `-`。

## 明确不做


## 假设

- IAM 按 `page`/`limit` 分页。

## 验收用例

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 列表展示四列。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 平台角色列与注解一致。
