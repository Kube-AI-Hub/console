# 集群切换与作用域侧栏（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-switch.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02

## 概述

侧栏按作用域取菜单；集群作用域在侧栏顶部提供切换器。

## 系统现状

- 老 console：集群控制台侧栏 = `Selector`（当前集群，点击开 `ClusterSelectModal`）+ 集群 Nav；
  平台页 `/access`、`/settings` 有平台侧栏；`/clusters` 无侧栏。
- 本应用此前侧栏固定为项目区：平台页与集群页都显示项目条目，点击会进入 `default` 项目。

## 仓库落点

- `apps/console-next/src/shell/AppShell.tsx`（作用域判定与侧栏数据源）
- `apps/console-next/src/shell/ClusterSwitcher.tsx`
- `apps/console-next/src/shell/useMulticluster.ts`
- `apps/console-next/src/lib/lastCluster.ts`

## 对外契约

读 `/kapis/config.kubesphere.io/v1alpha2/configs/configz`（`multicluster`）与集群列表；
不做写操作。

## 设计目标与非目标

目标：侧栏永远对应当前作用域；切换一步到位。非目标：跨集群聚合、在切换器里管理集群。

## 关键约束

- 侧栏数据源不新增第三份清单：项目/集群取注册表，平台取头部已有的 `MODULES.platform.children`。
- `Menu` 用 `activeKey` 高亮，不认 `items[].checked`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-01 — 列表保持页面，另加切换器

**为什么**：老 console 两者都有且职责不同——列表承担增删改与深链接，切换器承担"已在集群里"的快速跳转。把列表改成弹窗会让添加/编辑/移除无处安放，也让 URL 无法直接定位某集群。

**被否方案**：把 `/clusters` 改成弹窗、从任意页面唤起。代价是丢失深链接与管理入口。

**何时重新考虑**：平台只有一两个集群且几乎不管理成员时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-02 — 平台页也显示平台导航

**为什么**：老 console 的 `/clusters` 无侧栏，但本应用若有侧栏却显示项目条目，就是在误导；统一为平台导航，同时修掉 `/access`、`/settings` 上的同一问题。

**被否方案**：仅隐藏 `/clusters` 的侧栏。代价是同类页面行为不一致。

**何时重新考虑**：平台页改为全宽布局时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-SWITCH-03 — 切换后落到概览

**为什么**：与老 console 的 `enterCluster` 一致；并非每个集群都装了当前页所属模块，落到概览避免 404 观感。

**被否方案**：保持当前页面段。跨集群模块差异会让跳转后落到错误页。

**何时重新考虑**：集群模块信息可提前获知并在切换器里过滤。

## 不变量

1. 切换后侧栏的当前项就是「集群概览」。
2. 侧栏永不把平台/集群作用域的读者放进某个项目。

## 已知坑

- `Menu` 只认 `activeKey`；给条目传 `checked` 不会产生 `aria-current`。
- Playwright 的 `to_have_url` 对 `**/...` 形式在含协议的完整 URL 上可能不匹配，用正则断言路径更稳。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`：切换往返、三处作用域侧栏内容与高亮。

## 后续改进

- 切换器内显示集群告警摘要。
- 记住每个集群上次访问的页面。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02`
