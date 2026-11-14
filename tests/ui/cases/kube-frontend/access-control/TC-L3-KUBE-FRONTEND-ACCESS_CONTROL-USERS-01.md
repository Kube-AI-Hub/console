# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01 用户 · 列表四列与最近登录

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

用户列表四列为用户名、状态、平台角色、最近登录；首屏按 createTime 降序；最近登录等于该行 status.lastLoginTime，从未登录显示「尚未登录」。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 已知平台上有用户，当打开用户页，则显示用户名（副行邮箱）、状态、平台角色、最近登录四列，列顺序与此一致；首屏列表请求 `sortBy=createTime` 且降序，行顺序与同次 `/users?sortBy=createTime&ascending=false` 响应对齐；「最近登录」等于该行用户对象的 `status.lastLoginTime`（缺失时回退 `iam.kubesphere.io/last-login-time` 注解）；两者都没有时显示「尚未登录」，不显示 `-`，也不把改密时间当成登录时间。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清谁在平台上、是什么角色 (Priority: P1)

作为 **平台管理员**，我希望 **在列表上看到状态与平台角色**，以便 **确认访问范围**。

**Independent Test**：打开用户页，核对四列与某个用户的平台角色注解一致。

## 前置与配置

- 已登录，且有平台权限
- 该页至少有一条数据（用例先用 API 确认）

## 测试步骤

1. 打开用户页
2. 核对表头顺序
3. 用 API 拉 `/users?limit=10&sortBy=createTime&ascending=false`，核对该页行名顺序
4. 搜索 admin（若存在）或第一行用户名
5. 用 API 读取该用户，核对该行最近登录

## 期望结果

- 表头依次为 ["用户名", "状态", "平台角色", "最近登录"]
- 列表有行
- 行顺序与 `/users?limit=10&sortBy=createTime&ascending=false` 的 items 名称一致
- 最近登录等于 status.lastLoginTime 的本地时间；两者都空则显示尚未登录

## 失败排查

- 缺列时看 PlatformListPage 的 columns
- 显示改密时间：toUserSummary 仍在读 last-login-time 注解
- 空列表时用例 skip 而不是失败

## 产品改版后如何更新自动化

- 列变化时改 pages/access_control.py
