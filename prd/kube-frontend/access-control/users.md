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

### US5 - 不能误操作预置账号和自己 (Priority: P1)

作为 **平台管理员**，我希望 **预置账号和当前登录用户没有停用、删除、改角色、重置密码入口，也不能被勾选**，以便 **不会把平台锁在门外，也不会停掉正在用的会话**。

**Independent Test**：打开用户列表，`admin` 行没有复选框、没有停用/删除/重置密码；一个临时用户这些入口都在。

### US6 - 创建一个能首次登录的平台账号 (Priority: P1)

作为 **平台管理员**，我希望 **填写用户名、邮箱、初始密码、平台角色和可选描述后创建账号**，以便 **对方第一次登录时被要求改密，而不是一直使用我设的初始密码**。

**Independent Test**：创建临时用户后回读 `iam.kubesphere.io/uninitialized=true` 与所选平台角色；弱密码或非法用户名不发请求。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03** — 已知用户列表有数据，当行操作「修改平台角色」并选择平台管理员，则 `iam.kubesphere.io/platform-role` 变为 `platform-admin`；当「删除」并确认，则该用户不再出现在列表结果中。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02** — 已知在用户页，当点「创建」填写用户名、邮箱、密码、平台角色与可选描述并确认，则用户被创建且 `iam.kubesphere.io/platform-role` 等于所选角色、`iam.kubesphere.io/uninitialized` 为 `true`；填写了描述时 `kubesphere.io/description` 等于所填文本；用户名非法或密码弱于规则时提交被拦下并给出提示；密码输入过程中，字段下方显示强度面板（四条检查项与弱/中/强三档），随输入实时变化。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 已知平台上有用户，当打开用户页，则显示用户名（副行邮箱）、状态、平台角色、最近登录四列，列顺序与此一致；首屏列表请求 `sortBy=createTime` 且降序，行顺序与同次 `/users?sortBy=createTime&ascending=false` 响应对齐；「最近登录」等于该行用户对象的 `status.lastLoginTime`（缺失时回退 `iam.kubesphere.io/last-login-time` 注解）；两者都没有时显示「尚未登录」，不显示 `-`，也不把改密时间当成登录时间。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04** — 已知用户列表有数据，当点击名称列排序，则顺序变为升序；再次点击，则变为降序（两次结果不同）。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05** — 已知平台上有非 admin 用户，当对其执行「停用」，则该用户 `status.state` 变为 `Disabled`，行操作变为「启用」；执行「启用」后回到 `Active`；执行「删除」并确认后该用户从列表中消失；admin 账号不提供「停用」与「删除」。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06** — 已知平台上有用户，当对某人执行「编辑信息」并填写新的邮箱与描述后保存，则该用户的 `spec.email` 变为新邮箱、`kubesphere.io/description` 注解变为新描述；邮箱非法时提交被拦下并提示。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07** — 已知用户列表有多个非 admin 用户，当勾选其中两个并点「停用」，则这两个账号的 `status.state` 均变为 `Disabled`；再勾选并点「启用」，两者均回到 `Active`；admin 行没有复选框（不可被选中）。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08** — 已知当前登录用户是平台管理员，当打开用户列表，则 `admin` 与 `sonarqube`（若列表中有）以及当前登录用户既没有行复选框，行菜单也不含停用、启用、编辑信息、修改平台角色、重置密码、删除；一个非预置临时用户的行菜单含上述写操作（启用/停用按状态互斥）。

## 设计目标

把平台角色与状态变成可读列。

## 约束与边界

- 读 IAM 组 `users`；平台角色取 `iam.kubesphere.io/platform-role` 或 `iam.kubesphere.io/globalrole`。

## UI 交互设计

状态徽章：活跃为成功色。

创建用户弹窗字段顺序：用户名、邮箱、初始密码（强度面板）、平台角色、描述（可选 textarea）。
密码为空时不渲染强度面板；输入后显示四条检查项（大写与小写字母 / 数字 / 特殊字符 / 8–64 位）与弱/中/强三档。
句柄：`users:password-strength`（带 `data-strength`）、`users:password-strength-bar`、
`users:password-check-{case,digit,special,length}`（带 `data-met`）；输入框仍是 `#ai-field-password`。
面板的 `scope` 是 `users`，个人设置是 `user-settings`，两处句柄不串台。
行菜单在更多按钮内：启用/停用互斥，随后编辑信息、修改平台角色、重置密码、删除。预置与当前用户不渲染这些项，也没有行复选框。
1600 与 1280 四列全显（最近登录 `hideBelow: xl`，即 1280 起显示）；1024 显示用户名、状态、平台角色，最近登录列隐藏，仍可通过用户名进入详情核对登录时间。
默认排序与旧列表一致：`sortBy=createTime` 降序（最新创建在前）；点用户名列可改为按名称升/降序（createTime 不是可见列，故必须作为默认键，否则用户无法回到旧的时间序）。

## 文案与校验

- 列：用户名（副行邮箱）、状态、平台角色、最近登录。
- 状态：活跃 / 已停用。
- 从未登录：尚未登录。

## 边界情况

- 用户对象没有 `status` 时按活跃处理（平台没有声明停用）。
- `status.lastLoginTime` 与登录注解都缺失时显示「尚未登录」，不填 `-`、不填 0。

## 明确不做

- 企业空间成员、用户组、配额与跨作用域授权不在本页，见访问控制其它功能点。
- 不把个人设置的改密流程搬到列表（列表/详情的重置不填当前密码）。
- 列表列显隐：旧表 `isHideable`；新 ResourceList 无列开关，归 CHECK-08。
- 用户头像：旧列始终是 `/assets/default-user.svg`，用户对象没有 avatar 字段；新页用用户名 + 邮箱副行识别。

## 假设

- IAM 按 `page`/`limit` 分页。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 列表展示四列；最近登录取 `status.lastLoginTime`；默认 `sortBy=createTime` 降序。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02** — 创建用户写入平台角色，并标记 `uninitialized`。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08** — 预置账号与当前登录用户不可被勾选或执行写操作。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 最近登录与同次用户对象的 `status.lastLoginTime` 一致；从未登录显示「尚未登录」；首屏行序与 createTime 降序列表一致。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02** — 新用户注解含 `uninitialized=true` 与所选平台角色。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08** — `admin` 行无复选框且无破坏性行操作。
