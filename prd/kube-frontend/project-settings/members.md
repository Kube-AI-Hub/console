# 项目成员列表（L3）

[子模块需求](./_index.md)

## 概述

项目管理员在 `/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/members` 查看谁能进这个项目、邀请已有平台用户、调整项目角色、解除绑定。点名称不进入详情（旧页 `noLink`）。不需要切回旧控制台。

## 用户故事

### US1 - 看清谁在这个项目里、是什么角色 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到每个成员的角色、状态、邮箱与最近登录**，以便 **确认访问范围**。

**Independent Test**：打开成员列表，核对列与某个成员的 `iam.kubesphere.io/role` 注解一致；状态为「活跃 / 已停用」；未登录显示「尚未登录」。

### US2 - 邀请与移除项目成员 (Priority: P1)

作为 **项目管理员**，我希望 **把平台用户加入项目、改他们的角色、或把他们移出项目**，以便 **不用去平台级用户管理里绕一圈**。

**Independent Test**：邀请一次性账号为 viewer → 回读成员存在且角色为 viewer → 改为 operator → 回读角色更新 → 移除 → 回读成员不存在，平台账号仍在。

### US3 - 在成员表上找到人且不能操作自己 (Priority: P1)

作为 **项目管理员**，我希望 **按名称搜索、看到邮箱，并且不能改或移除自己**，以便 **日常查人时不会把自己踢出项目**。

**Independent Test**：打开成员页，搜索已知成员能收窄列表；当前登录用户没有行菜单和复选框；批量移除需输入选中人数确认。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01** — 已知项目内有成员，当打开成员列表，则显示名称（副行邮箱）、状态、角色、最近登录四列；角色列等于 `iam.kubesphere.io/role`；状态显示「活跃 / 已停用」；从未登录显示「尚未登录」。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02** — 已知项目内没有某成员，当点「邀请成员」并提交存在的用户名与项目角色，则该用户出现在成员列表中且 `iam.kubesphere.io/role` 为所选角色；对该成员执行「修改角色」并提交新角色后，回读角色已更新；执行「移除成员」确认后，该成员从列表与接口中消失（用户账号本身不受影响）。POST 体为数组成员；PUT/DELETE 按用户名。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03** — 已知成员列表可读，当打开成员页，则用户名下显示邮箱；可按名称搜索；当前登录用户不可勾选、无修改/移除菜单；批量移除需输入选中人数确认，且不包含自己。

## 设计目标

把注解里的角色与状态变成可读列，并补齐旧页的查找、自我保护和批量解绑。

## 约束与边界

- 角色取 `iam.kubesphere.io/role` 注解。
- 「最近登录」取 `status.lastLoginTime`，缺省再回退 `iam.kubesphere.io/last-login-time`；不把改密时间标成登录。
- 当前登录用户不能改自己的项目角色或把自己移出项目。
- 角色权限、账号读取和成员写权限由服务端权威校验。

## UI 交互设计

邀请是唯一主操作；修改角色和移除放在行菜单。表单复用 MemberDialog；移除复用 DeleteDialog：单人输入用户名，批量输入人数。列表提供搜索、多选和加载反馈。用户名不链到详情。

## 文案与校验

- 列：名称、状态、角色、最近登录。
- 状态：`platform.status.active` / `platform.status.disabled`；未登录：`platform.column.notLoginYet`。
- 用户名不可为空，角色必须属于当前项目非模板角色。

## 边界情况

- 没有成员时显示空态。
- 角色注解缺失时显示 `-`。
- 搜索无匹配：表格空，不重新发明服务端参数之外的查询。
- 缺 `status.state` 按活跃处理。

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01** — 列表展示名称、邮箱、状态、角色、最近登录。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02** — 邀请、改角色、移除与刷新闭环。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03** — 搜索、自我保护与批量移除。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01** — 角色列与注解一致；未登录显示「尚未登录」。
- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02** — 三次写入的回读结果正确，移除后平台账号保持存在。
- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03** — 当前用户行无复选框与写菜单；批量确认词是人数。

## 明确不做

- 不删除平台用户，不编辑角色权限规则，不管理租户(企业空间)成员绑定。
- 邀请不改成旧页的用户搜索弹窗（继续输入用户名）。
- 不做项目成员详情页（旧页名称 `noLink`）。

## 假设

- IAM 的 members 投影带角色注解，并可按 `namespaces/<ns>/members` 读写。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03`
