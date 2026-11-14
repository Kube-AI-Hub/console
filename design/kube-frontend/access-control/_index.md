# 访问控制（L2）

[子模块需求](../../../prd/kube-frontend/access-control/_index.md)

## 关联需求

- `AC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01`
- `AC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02`

## 概述

平台级三张表：用户、平台角色、企业空间。区域根路径 `/kube-frontend/access` 默认进入用户表。

## 设计目标与非目标

目标：平台作用域有独立布局；三种数据源各自正确；区域根路径落到 registry 的 `defaultPage`。非目标：在根路径做独立落地页。

## 关键约束

- 用户/平台角色走 IAM 组；企业空间走 resources 代理。
- 路径 `/kube-frontend/access/<page>`；无页签段时必须落到 `users`。

## 方案决策

### DEC-L2-KUBE-FRONTEND-ACCESS_CONTROL-01 — 平台作用域独立布局

**为什么**：与集群页同理——复用项目布局会渲染一个对页面毫无影响的项目切换器。

**被否方案**：复用集群布局。它的页签与作用域 root 都是集群的，平台页会被塞进错误的面包屑。

**何时重新考虑**：出现「按企业空间过滤用户」这类需求时，加显式筛选器。

### DEC-L2-KUBE-FRONTEND-ACCESS_CONTROL-02 — 三种数据源在 api-client 里显式区分

**为什么**：用户/平台角色在 IAM 组，企业空间在 resources 代理。走错来源的报错很不直观（一个 404、一个 "resource is not supported"），把来源写在一处比散落在页面里可靠。

**被否方案**：在页面里按 kind 拼 URL。页面会同时知道 URL 形状与视图模型，职责混乱。

### DEC-L2-KUBE-FRONTEND-ACCESS_CONTROL-03 — 根路径用 index redirect 进用户表

**为什么**：老 console 的 access 布局用 `getIndexRoute` 把 `/access` 指到侧栏第一项（`accounts`）。新 UI 把该项登记为 `users`，侧栏仍指向区域根 `/kube-frontend/access`。布局用 `areaOfPage('platform', segment)` 找页签，空 segment 找不到区域，于是根路径只剩空白 chrome。应用商店已经用 `beforeLoad` redirect 解决同一问题。

**被否方案**：在 `/access` 直接渲染用户表、不改 URL。页签高亮依赖 segment，根路径会永远对不上「用户」；书签与 `/users` 分裂成两个地址。

**何时重新考虑**：若产品要在根路径做三张表的卡片落地页，再拆独立 index 组件，redirect 收回。

## 系统现状

老 console `pages/access/containers/{Accounts,Roles,Workspaces}`。用户与平台角色的写操作（创建、改角色、停用/启用/删除、编辑信息）已迁移；企业空间的写操作与成员管理未迁移。

## 仓库落点

- `apps/console-next/src/pages/platform/`
- `src/routes/kube-frontend.access/`
- `packages/api-client/src/access.ts`

## 对外契约

读走 IAM 与 resources 代理；写走 IAM 的整对象 PUT（PATCH 返回 405）；分页参数随请求下发。

## 不变量

1. 平台页不出现项目工作区栏。
2. 用户与平台角色只经 IAM 组读取，企业空间只经 resources 代理。
3. `/kube-frontend/access` 不渲染无页签的空白布局。

## 已知坑

- 用户量数千，首屏慢，必须有加载态。
- 平台角色里模板角色占多数，需徽标区分。

## 测试与可观测

E2E：`tests/kube-frontend/access-control/`。

## 后续改进

用户创建与角色分配、平台设置（通知渠道）。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01`
- `TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02`

## 页面与技术结构

- 区域 `access`（`scope: 'platform'`，三页，`defaultPage: 'users'`），布局 `kube-frontend.access/route.tsx`。
- 根路径 `kube-frontend.access/index.tsx`：`beforeLoad` redirect 到 `/kube-frontend/access/users`。
- 组件 `PlatformListPage`，描述符在 `pages/platform/queries.ts`。

## 状态与数据归属

- 页面只持有 UI 态；数据在 Query 缓存。

## 关键契约与依赖

- `usersApi` / `clusterRolesApi` / `workspacesApi`。

## 明确不做

- 用户、角色、企业空间的写操作；平台设置。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 用户 | `prd/…/users.md` | `design/…/users.md` |
| 平台角色 | `prd/…/platform-roles.md` | `design/…/platform-roles.md` |
| 企业空间 | `prd/…/workspaces.md` | `design/…/workspaces.md` |
