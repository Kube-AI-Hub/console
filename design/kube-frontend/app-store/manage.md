# 商店管理（L3）

[子模块需求](../../../prd/kube-frontend/app-store/manage.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01
- AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02
- AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-03

## 概述

`/kube-frontend/apps-manage` 区域：应用 / 分类 / 审核 三个页签。

## 系统现状

老 console 的 `/apps-manage` 默认跳 `/store`，另有 `/categories` 与 `/reviews/:type`。
新 UI 顶栏「平台管理 › 应用商店管理」指向 `/kube-frontend/apps-manage`，**路由同样从未存在**。

## 仓库落点

- `apps/console-next/src/pages/appstore/StoreManagePage.tsx`
- `routes/kube-frontend.apps-manage/{route,index,store,categories,reviews}/`
- `areas/registry.ts` 的 `app-store` 区域（scope=platform）

## 对外契约

`GET /kapis/openpitrix.io/v1/{apps,categories,reviews}`。

## 设计目标与非目标

目标：让「商店里有什么」可见，并把管理入口补齐。非目标：写操作（建分类、审核通过/驳回）。

## 关键约束

- 写操作本轮**明确未做**：商店无应用、无审核记录，写流程无法验证。登记为缺口，不猜实现。
- 默认页签是「应用」（与老 console 的 `/store` 一致），不是分类。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01 — 复用平台区域页签，不新建壳

**为什么**：`app-store` 与 `access`、`settings` 一样是平台作用域区域；复用 `AreaTabs` 让
面包屑、页签高亮与其它平台页一致。

**被否方案**：在一个页面里手写三个 Tab。代价是页签行为与其它区域不一致（不可中键新开等）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02 — 提供「刷新」而不是自动轮询

**为什么**：缺口分析点名「列表无刷新出口」；商店数据变化不频繁，手动刷新足够，且避免后台请求。

## 不变量

1. `/apps-manage` 永远重定向到 `/store`。
2. 三个页签互不依赖：一个为空不影响其它。

## 已知坑

- 区域页签依赖 `areaOfPage('platform', segment)`，segment 必须与 registry 的 `path` 一致，
  否则 `area` 为空、页签整条不渲染。

## 测试与可观测

`test_TC_L3_KUBE_FRONTEND_APP_STORE_MANAGE_01.py`：默认重定向、三个页签、各页签列表/空态、刷新按钮。

## 后续改进

- 分类 CRUD、审核通过/驳回、应用下架。
- 应用仓库管理。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01`
