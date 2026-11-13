# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-04 平台角色详情 · 授权规则

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `platform-roles`
- **入口**: `{BASE_URL}/kube-frontend/access/clusterroles`
- **需求**: `prd/kube-frontend/access-control/platform-roles.md`

## 产品功能

从平台角色列表点名称进入详情：名称、别名、规则数、创建时间、描述，以及逐条授权规则（API 组/资源/动词）；模板角色带徽标。

### 关联需求

- `prd/kube-frontend/access-control/platform-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-04** — 已知平台角色列表中有角色，当点击角色名称进入详情，则显示名称、别名、规则数、创建时间与描述，并逐条列出该角色的授权规则（API 组、资源、动词）；规则条数等于角色对象 `rules` 的长度；`role-template-*` 角色带「模板」徽标并只读。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/platform-roles.md`](../../../../design/kube-frontend/access-control/platform-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 看清一个平台角色到底授权了什么 (Priority: P1)

作为 **平台管理员**，我希望 **在角色详情里看到逐条规则**，以便 **判断这个角色能不能给人**。

**Independent Test**：从列表点进一个非模板角色，核对其规则条数等于对象 `rules` 长度。

## 前置与配置

- 已登录平台管理
- 平台上有平台角色（clusterroles）

## 测试步骤

1. 用 API 读取平台角色列表与其中第一个非模板角色的对象
2. 打开平台角色列表，点击该角色名称
3. 核对 URL 与基本信息（规则数等于 rules 长度）
4. 核对规则表行数等于 rules 长度

## 期望结果

- 详情页可达且 ready
- 规则数显示与对象 rules 长度一致
- 规则逐条渲染（API 组/资源/动词）

## 失败排查

- 规则为空：读的是列表接口而非单个对象
- 名称不可点：列表名称未接详情链接
- 显示原始 key：新增文案后未重新构建前端包

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 ClusterRoleDetailPage.tsx
