# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-05 平台角色详情 · 已授权用户

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `platform-roles`
- **入口**: `{BASE_URL}/kube-frontend/access/clusterroles`
- **需求**: `prd/kube-frontend/access-control/platform-roles.md`

## 产品功能

平台角色详情展示被授权对象（类型+名称），条数等于 roleRef 指向该角色的 clusterrolebindings 的 subjects 总数。

### 关联需求

- `prd/kube-frontend/access-control/platform-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-05** — 已知某平台角色被授权给若干账号，当打开该角色详情，则「已授权用户」区块逐条列出被授权对象（类型 + 名称，服务账户附命名空间），条数等于 clusterrolebindings 中 roleRef 指向该角色的 subjects 总数；没有被授权时显示说明；授权信息读取失败时只该区块降级。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/platform-roles.md`](../../../../design/kube-frontend/access-control/platform-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 谁被授予了这个角色 (Priority: P1)

作为 **平台管理员**，我希望 **在角色详情看到被授权对象**，以便 **回答「收掉这个角色会影响谁」**。

**Independent Test**：打开 cluster-admin 详情，核对「已授权用户」条数等于 roleRef 指向它的绑定里 subjects 总数。

## 前置与配置

- 已登录平台管理
- 平台上存在被授权的平台角色（cluster-admin 通常有）

## 测试步骤

1. 用 API 读取 clusterrolebindings，按 roleRef 过滤出 cluster-admin 的 subjects
2. 打开 cluster-admin 详情
3. 核对「已授权用户」条数与对象

## 期望结果

- 区块存在且条数等于 subjects 总数
- 每个被授权对象显示类型与名称

## 失败排查

- 区块为空但角色确实被授权：绑定列表分页没取全（limit 要够大）
- 只有用户没有服务账户：subjects 里有 ServiceAccount 类型，别只过滤 User

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 ClusterRoleDetailPage.tsx
