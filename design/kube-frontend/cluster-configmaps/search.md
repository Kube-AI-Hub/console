# 按名称搜索 · 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/search.md`](../../../prd/kube-frontend/cluster-configmaps/search.md)。

## 概述

搜索在共享控制器里实现，两个页面只差数据来源。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01`

## 设计目标与非目标

**目标**：与项目级同一套防抖与请求参数。

**非目标**：不做多字段搜索。

## 关键约束

- 防抖 250ms，同时重置页码。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01 — 搜索参数沿用项目级拼写

**为什么**：服务端参数是 `name`，项目级已验证。换一套拼写等于给同一件事写第二个契约。

**被否方案**：在前端做本地过滤。跨项目集合可能有数千条，只翻一页就会漏掉匹配。

## 系统现状

`useConfigMapListController` 同时服务两个页面，搜索逻辑只有一份。

## 仓库落点

- `apps/console-next/src/pages/configmaps/controller.ts`

## 对外契约

- `GET .../configmaps?name=<keyword>&page=1&limit=10`

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01** — 搜索值变化后页码必然回到 1。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01** — 防抖值与请求参数必须是同一个状态，分两处维护会出现「点了搜索但请求没带」。

## 测试与可观测

- `test/cluster-configmaps-page.test.tsx` 覆盖防抖后的请求参数。

## 后续改进

- 若服务端支持 `labelSelector`，可扩展为按注释搜索。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01`
