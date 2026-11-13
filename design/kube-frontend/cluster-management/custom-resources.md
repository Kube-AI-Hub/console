# 自定义资源 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/custom-resources.md)

## 概述

CRD 列表：读 apiextensions 组，一次取全量，前端搜索与排序。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01

## 设计目标与非目标

目标：一屏回答「这个集群能写哪些资源」；作用域与 served 是两个独立事实。

非目标：CRD 详情/实例列表、CRD 写操作、按组分组。

## 关键约束

- `GET /apis/apiextensions.k8s.io/v1/customresourcedefinitions?limit=-1`
- 返回 `{items}`，每项含 `spec.{group,scope,names.kind,versions[]}`。
- apiextensions **没有**排序参数。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01 — 读 apiextensions，不读 resources 代理

**为什么**：这页回答「集群能提供什么」。resources 代理在其他资源上被观察到对新对象有滞后，一个滞后的答案会让读者以为某个 CRD 不存在。apiextensions 是权威来源。

**被否方案**：走代理以复用 `resourceApi`。省几行代码，换来一个可能过时的答案。

**何时重新考虑**：代理被证明与原生一致且有统一的错误处理。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02 — 排序在前端，不发给服务端

**为什么**：apiextensions 没有 `sortBy` 参数。发了会被忽略——这正是存储类型页排序看起来死掉的根因。前端排序对几百条数据没有成本。

**被否方案**：照抄其他列表的 `sortBy` 参数。看起来一致，实际无效。

**何时重新考虑**：CRD 数量达到数千需要服务端分页时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-03 — 版本列表按存储版本优先

**为什么**：同一个 CRD 可以有多个版本，「当前存的是哪个」决定了读者该看哪个。按 `storage: true` 排首位，其余保持声明顺序；副行只显示首个。

**被否方案**：按声明顺序。声明顺序没有语义，读者无法判断哪个是权威版本。

**何时重新考虑**：需要在列表上展示全部版本时（届时副行改为可展开）。

## 系统现状

老 console 的 CRD 页列为 类型（副行 `组/最新版本`）、名称、作用域、创建时间，并提供详情页列出该类型的实例。本次迁移实现列表；详情另立功能点，并在 PRD「明确不做」中写明原因。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/CustomResourcesPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/custom-resources/`
- 区域注册：`areas/registry.ts`（cluster-management 增加 custom-resources）
- 接口：`packages/api-client/src/cluster.ts` 的 `customResourcesApi` / `toCustomResourceSummary`
- 文案：`packages/locales/src/index.ts`（`cluster.customResources.*`）

## 对外契约

`GET /apis/apiextensions.k8s.io/v1/customresourcedefinitions?limit=-1`

## 不变量

1. 行数等于接口返回的 CRD 数。
2. 作用域只可能是「集群级」或「命名空间级」。
3. `served` 由 `versions[].served` 推导：任一版本 served 即为已提供。
4. 排序不改变请求（没有服务端排序）。

## 已知坑

- **`limit=-1`**：不带时可能只回第一页，列表会静默缺行。
- **served 是版本级字段**：`spec.versions[].served`，不是 CRD 级；读错层级会让所有 CRD 都显示「未提供」。
- **kind 与 name 都是搜索目标**：用户排错时手里是 `widgets.example.com`，写 manifest 时想的是 `Widget`。
- **apiextensions 的 group 与 resources 代理不同源**：两者的分页与错误形状可能不一致，不要互相对账。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01.yaml`
可观测点：`custom-resources:surface`、`custom-resources:search`、`data-ai-row=<crd 全名>`。

## 后续改进

- CRD 详情：列出该类型的实例（动态组/版本/复数路径）。
- 按组折叠展示。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01
