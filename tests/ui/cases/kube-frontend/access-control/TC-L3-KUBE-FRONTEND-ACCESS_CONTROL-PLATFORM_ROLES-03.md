# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-03 平台角色列表 · 分页可寻址且可前后翻页

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `platform-roles`
- **入口**: `{BASE_URL}/kube-frontend/access/clusterroles`
- **需求**: `prd/kube-frontend/access-control/platform-roles.md`

## 产品功能

分页控件带稳定 data-ai-id（<列表>:page:prev / next），点击下一页换页、点上一页返回。

### 关联需求

- `prd/kube-frontend/access-control/platform-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-03** — 已知平台角色超过一页，当打开列表，则分页控件带稳定标识 `<list>:page:prev` / `<list>:page:next`；点「下一页」则内容变化，点「上一页」则回到与首页一致的顺序。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/platform-roles.md`](../../../../design/kube-frontend/access-control/platform-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清平台上有哪些角色 (Priority: P1)

作为 **平台管理员**，我希望 **看到规则数与是否模板**，以便 **区分可分配与内置角色**。

**Independent Test**：打开平台角色页，核对列与某个角色行。

## 前置与配置

- 已登录，且有平台权限
- 平台角色超过一页

## 测试步骤

1. 打开平台角色列表，记录第一页
2. 点「下一页」，记录第二页
3. 点「上一页」，记录回到的顺序

## 期望结果

- 存在 clusterroles:page:next 与 clusterroles:page:prev 两个标识
- 第二页与第一页不同
- 回到第一页后顺序与初始一致

## 失败排查

- 只有 prev 没有 next 说明 next 分支未传 aiPrefix
- 翻页无效说明 onPageChange 未接到查询

## 产品改版后如何更新自动化

- 分页数据结构变化时改 ai-kit 的 Pagination
