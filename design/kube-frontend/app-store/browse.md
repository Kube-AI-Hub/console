# 商店浏览（L3）

[子模块需求](../../../prd/kube-frontend/app-store/browse.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01
- AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-02
- AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-03

## 概述

`/kube-frontend/apps`：分类栏 + 应用卡片网格。

## 系统现状

老 console 的 `/apps` 是商店首页（PublishedAppStore + CategoryStore），无应用时给空态。
新 UI 顶栏「应用商店」从壳层建好起就指向 `/kube-frontend/apps`，但**路由从未存在**——缺口分析里的死链之一。
openpitrix 模块实际是开启的（`configz.openpitrix=true`），`apps`/`categories` 均返回 200。

## 仓库落点

- `packages/api-client/src/appstore.ts`（`storeAppsApi` / `storeCategoriesApi` / `storeReviewsApi`）
- `apps/console-next/src/pages/appstore/AppStorePage.tsx`
- `routes/kube-frontend.apps/{route,index}.tsx`

## 对外契约

`GET /kapis/openpitrix.io/v1/{apps,categories}`，paging 用 `page`/`limit` + `total`，
字段是 snake_case（`category_id`、`app_total`、`create_time`）——**不是 Kubernetes 对象**，
所以不复用 `resourceApi`。

## 设计目标与非目标

目标：让顶栏入口真的能用；商店为空时解释原因。非目标：应用详情、安装、评分。

## 关键约束

- `locale` 是 JSON 字符串：`{"zh-CN":{"name":"…"}}`，按 zh-CN → zh → en → 首个可用语言取；
  解析失败退回原始 `name`，不能让一个分类名解析失败拖垮整页。
- 空态与失败态必须区分：前者是运维配置问题，后者是故障。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01 — 独立的 openpitrix 客户端，不复用 resourceApi

**为什么**：字段命名、分页参数、错误形状都与 Kubernetes 资源不同；强行套用会让每个页面都要
记住"这个资源是假的"。

**被否方案**：把 openpitrix 伪装成 KubeObject。代价是 mapper 里到处是兼容分支。

**何时重新考虑**：openpitrix 换成 Kubernetes CRD 形态时。

## 不变量

1. 分类解析失败不抛错，退回原始 name。
2. 空商店显示「没有应用」并说明来源是应用仓库。

## 已知坑

- `apps` 的 `category_ids` 与 `category_id` 两种字段都可能出现，两种都读。
- 顶栏链接原本是死链：`/apps` 与 `/apps-manage` 必须同时存在，否则点了仍然是空白。

## 测试与可观测

`test_TC_L3_KUBE_FRONTEND_APP_STORE_BROWSE_01.py`：分类栏、空态/列表、商店管理跳转。

## 后续改进

- 应用详情与安装流程。
- 仓库管理（`/repos`）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01`
