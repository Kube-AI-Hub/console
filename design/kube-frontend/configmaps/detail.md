# 配置字典详情 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/detail.md`](../../../prd/kube-frontend/configmaps/detail.md)。

## 概述

详情页只读展示一个对象，并把四个编辑入口挂在其上。数据来自与列表相同的 kapis 资源端点，多取一个路径段。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02`

## 设计目标与非目标

**目标**：值原样可读；操作入口与列表行操作完全一致；加载与失败都有明确状态。

**非目标**：不做键值内联编辑，不做只读 YAML 视图——两者都由已有弹窗覆盖。

## 关键约束

- 端点与旧 console 一致：`GET /kapis/resources.kubesphere.io/v1alpha3[/clusters/{c}]/namespaces/{ns}/configmaps/{name}`，不新增聚合端点。
- 详情页是 `AiSurface` 的一个区域，状态通过 `data-ai-state` 发布。
- 值用 `whitespace-pre-wrap`，保留配置内容自身的换行。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01 — 四个操作放在头部而非侧栏

**为什么**：旧 console 的详情页把操作放在信息卡右上角的按钮组里，用户已经在那个位置找它们。列表的行操作菜单也提供同样四项，两处位置不同但内容相同，学习成本只付一次。

**被否方案**：放进右侧 Tab 或底部操作条。前者会把「看一眼」变成「切一次」，后者在长值页面要滚到底才能操作。

**何时重新考虑**：操作超过五项需要分组时。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02 — 不展示 labels 与 annotations

**为什么**：旧 console 的详情页只列集群、项目、创建时间、创建者四项，没有标签区。把它补上会让两个前端对同一对象的「详情」含义不同，迁移时反而要重新对齐。

**被否方案**：加一个可折叠的「元数据」区。信息更全，但超出了本期「与旧版一致」的边界。

**何时重新考虑**：需求方明确要求查看注解时；届时先改需求。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-03 — 时间按本地时区、固定格式渲染

**为什么**：旧 console 用 `YYYY-MM-DD HH:mm:ss`。沿用同一格式，两个前端并排对照时不必换算。

**被否方案**：`Intl.DateTimeFormat` 的本地化短格式。更贴合语言设置，但与旧版不一致，列表与详情还会出现两种时间样式。

**何时重新考虑**：统一全站时间展示时，列表与详情一起改。

## 系统现状

列表页已有，详情路由已存在但只渲染键值对。本功能补齐属性区与操作入口。

## 仓库落点

- 路由与页面：`kube-frontend/apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace.configmaps.$name.tsx`
- 数据映射：`kube-frontend/packages/api-client/src/configmaps.ts`（`toDetail`）
- 操作弹窗：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapEditDialogs.tsx`、`ConfigMapYamlDialog.tsx`、`ConfigMapDeleteDialog.tsx`

## 对外契约

沿用 L1 的 ConfigMap 契约，不新增端点。详情响应是 kube 原生 `ConfigMap`，映射为 `ConfigMapDetail`（含 `alias`、`creator`、`labels`、`annotations`、`raw`）。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01** — 详情页的四个操作必须与列表行操作指向同一组组件，不允许各写一份。
- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02** — 值不得截断或折叠。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01** — 详情与列表共用父路由时，父路由若无条件渲染列表，子路由将被吞掉且无报错。
  处置：父路由检测路径是否还有子段，有则渲染 `<Outlet />`。这一条是靠浏览器实测发现的，单元测试不会暴露。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02** — 详情页删除对象后若不跳回列表，页面会在下一次重新拉取时显示 404。
  处置：删除成功后立即导航到列表路由。

## 测试与可观测

- 单元：值带换行时仍完整渲染；属性区四项齐全。
- 约束：`config/ai-surface-contract.test.ts` 保证页面经 `AiSurface` 发布状态。

## 后续改进

与需求「明确不做」保持一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02`
