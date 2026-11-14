# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07 用户列表 · 批量停用与启用

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

用户列表支持多选后批量停用/启用；admin 不可被勾选。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07** — 已知用户列表有多个非 admin 用户，当勾选其中两个并点「停用」，则这两个账号的 `status.state` 均变为 `Disabled`；再勾选并点「启用」，两者均回到 `Active`；admin 行没有复选框（不可被选中）。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 批量停用/启用账号 (Priority: P2)

作为 **平台管理员**，我希望 **一次停用多个离职账号**，以便 **不必逐个打开行菜单**。

**Independent Test**：创建两个临时用户 → 勾选两者 → 停用 → 回读均为 Disabled → 启用 → 均 Active。

## 前置与配置

- 已登录平台管理
- 用例自行创建两个临时用户（tc-e2e- 前缀），finally 中删除

## 测试步骤

1. 用 API 创建两个临时用户
2. 在用户列表勾选两者，点「停用」
3. 用 API 回读两个账号的 status.state
4. 点「启用」，再回读
5. 核对 admin 行没有复选框

## 期望结果

- 批量停用后两者均为 Disabled
- 批量启用后两者均为 Active
- admin 行不可选中

## 失败排查

- {'勾选框点不动：schema 未声明 selection': 'multiple'}
- 点击后无反应：onBulkAction 未接上（ResourceList 用 onBulkAction 而不是 onAction）
- 第二次状态没变：PUT 前未重新 GET（resourceVersion 过期 → 409）

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 PlatformListPage.tsx
