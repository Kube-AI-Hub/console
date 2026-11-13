# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05 用户列表 · 停用、启用与删除账号

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

非 admin 用户可停用/启用与删除：停用写 status.state=Disabled 并让行操作换成「启用」，删除后从列表消失；admin 不提供这两项。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05** — 已知平台上有非 admin 用户，当对其执行「停用」，则该用户 `status.state` 变为 `Disabled`，行操作变为「启用」；执行「启用」后回到 `Active`；执行「删除」并确认后该用户从列表中消失；admin 账号不提供「停用」与「删除」。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 停用、启用与删除账号 (Priority: P1)

作为 **平台管理员**，我希望 **停用不再使用的账号或直接删除**，以便 **不让离职账号继续持有凭据**。

**Independent Test**：创建一个临时用户 → 停用 → 回读 Disabled → 启用 → 回读 Active → 删除 → 列表不再包含。

## 前置与配置

- 已登录平台管理
- 用例自行创建临时用户（tc-e2e- 前缀），finally 中确保删除

## 测试步骤

1. 用 API 创建临时用户
2. 在用户列表中搜索该用户，执行「停用」，回读 status.state
3. 确认行操作变为「启用」，执行后回读 Active
4. 执行「删除」并确认，核对列表不再包含
5. 核对 admin 行没有「停用」与「删除」

## 期望结果

- 停用后 status.state 为 Disabled
- 启用后回到 Active
- 删除后用户不在列表中
- admin 行不提供停用/删除

## 失败排查

- 停用返回 405：PATCH 不被支持，必须 GET 后 PUT 整对象
- 第二次切换 409：PUT 前没有重新 GET（resourceVersion 过期）
- 删除后仍可见：列表未失效或搜索条件未变

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 PlatformListPage.tsx
