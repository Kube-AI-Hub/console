# 应用商店 · 技术方案（L2）

## 概述

两个顶栏入口（浏览 / 管理）共用一个 openpitrix 客户端与一套区域页签约定。

## 关联需求

- `AC-FULL-KUBE-FRONTEND-APP-STORE-01`

## 设计目标与非目标

目标：让两个入口可达、数据可读、空态可解释。非目标：安装与写操作。

## 关键约束

- openpitrix 不是 Kubernetes API：snake_case 字段、`page/limit/total` 分页、错误形状不同。
- 管理页是平台作用域区域（`scope: 'platform'`），复用 `AreaTabs`。

## 页面与技术结构

```text
routes/kube-frontend.apps/            → pages/appstore/AppStorePage.tsx
routes/kube-frontend.apps-manage/     → 区域壳（AreaTabs）
  ├─ store/      → pages/appstore/StoreManagePage.tsx(view=store)
  ├─ categories/ → 同上(view=categories)
  └─ reviews/    → 同上(view=reviews)
packages/api-client/src/appstore.ts   → storeAppsApi / storeCategoriesApi / storeReviewsApi
```

## 状态与数据归属

全局开店数据（无命名空间）。区域定义在 `areas/registry.ts` 的 `app-store`。

## 关键契约与依赖

`GET /kapis/openpitrix.io/v1/{apps,categories,reviews}`。

## 不变量

1. `/apps-manage` 重定向到 `/store`。
2. 顶栏两个入口都不得再指向不存在的路由。

## 已知坑

- 顶栏死链曾长期存在：壳层声明了路径但 `src/routes/` 下没有目录，点击落到空白。
- `locale` 是 JSON 字符串，解析要容错。

## 测试与可观测

L2：两个入口导航与页签切换；L3：`browse` 与 `manage` 各自的功能点。

## 明确不做

- 安装、商店写操作、仓库管理。

## 后续改进

- 应用详情与安装向导。
- 分类/审核的写操作。

## 功能点

见 `browse.md`、`manage.md`。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-APP-STORE-01`
