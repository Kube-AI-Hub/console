# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01 用户详情 · 基本信息与登录历史

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `user-detail`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/user-detail.md`

## 产品功能

从用户列表点用户名进入详情：用户名、邮箱、平台角色、状态、创建时间、最近登录、描述，以及当前页登录记录（时间、状态、来源 IP、原因）。

### 关联需求

- `prd/kube-frontend/access-control/user-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01** — 已知平台上有用户，当从列表点用户名进入详情，则显示用户名、邮箱、平台角色、状态、创建时间、最近登录与描述；「最近登录」等于用户对象 `status.lastLoginTime`（缺失回退注解，仍无则「尚未登录」）；登录历史列出当前页记录（默认每页 10 条），条数等于 `/users/<名>/loginrecords?page=1&limit=10` 返回的 `items` 数；没有记录时显示空态说明。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/user-detail.md`](../../../../design/kube-frontend/access-control/user-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认这个账号最近有没有在用 (Priority: P1)

作为 **平台管理员**，我希望 **看到某个用户的最近登录记录**，以便 **判断账号是需要清理还是只是暂时没人用**。

**Independent Test**：打开用户详情，核对最近登录时间与用户对象 `status.lastLoginTime` 一致，登录记录条数等于接口返回条数。

## 前置与配置

- 已登录平台管理
- 平台上至少有一个用户（优先使用 ui-test）

## 测试步骤

1. 用 API 读取用户与登录记录
2. 打开用户列表，点击该用户名
3. 核对 URL 与基本信息
4. 核对「最近登录」与 status.lastLoginTime 一致
5. 核对登录历史条数等于接口返回条数

## 期望结果

- 详情页可达且 ready
- 状态与 status.state 一致（缺失按 Active）
- 最近登录等于 status.lastLoginTime（回退注解）
- 登录记录条数与 /loginrecords 返回一致

## 失败排查

- 最近登录显示改密时间：读的是注解而非 status.lastLoginTime
- 登录历史为空但接口有条目：读取的不是 loginrecords 集合
- 整页报错而登录记录不可用：两个查询未独立降级

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 UserDetailPage.tsx
