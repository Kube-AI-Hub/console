# 系统组件（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/components.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01

## 概述

集群级只读的系统组件健康列表。

## 设计目标与非目标

目标：异常优先可见。非目标：组件运维操作。

## 关键约束

- 接口返回裸数组；一次性取回后在页面内排序与过滤。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-COMPONENTS-01 — 不健康优先排序，而不是按名字

**为什么**：49 个组件按名字排列时，一个掉线的组件会淹没在中间。管理员打开这页的唯一问题通常是「有没有不正常」。

**被否方案**：沿用服务端顺序。顺序本身没有语义，等于把最重要的信息随机放置。

**何时重新考虑**：组件数量级增长到需要分组（按模块）时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-COMPONENTS-02 — 走独立读取器，不用 resourceApi

**为什么**：`/kapis/.../components` 返回**裸数组**（实测响应以 `[` 开头），而 `resourceApi` 期待 `{items}` 包装。硬套会得到一个静默的空页。读取器同时接受两种形状，避免版本差异再次变成空白。

**被否方案**：在 `resourceApi` 里加特例。会让「标准信封」这个前提失效，影响所有资源。

**何时重新考虑**：接口统一为标准信封时。

## 系统现状

老 console 按模块分组展示组件；本模块单一列表 + 异常优先，现支持概览下钻的六类分类筛选。

## 仓库落点

- `apps/console-next/src/pages/cluster/ComponentsPage.tsx`
- `packages/api-client/src/storage.ts` 的 `componentsApi` / `toComponentSummary`
- `src/routes/kube-frontend.clusters.$cluster/components/`

## 对外契约

读 `/kapis/resources.kubesphere.io/v1alpha3/components`（裸数组，无分页参数）。

## 不变量

1. 无后端不视为健康。
2. 两种响应形状都能读。

## 已知坑

- 裸数组：把它当 `{items: undefined}` 会得到空列表且不报错。
- `healthyBackends` 缺省时按 0 处理。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`。

## 后续改进

按模块分组、组件详情（Pod 列表）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01`

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-03 — 分类与异常优先共存

**为什么**：概览组件入口需要将用户带到目标模块；分类是查询结果的 namespace 筛选，不需要第二套列表，仍能保持异常优先。

**被否方案**：把所有模块配置开关当作组件入口或取消分类，会丢失旧页面的排障路径。

**何时重新考虑**：后端引入更可靠的组件类别标签时替换 namespace 映射。

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01 — 集群与分类

host 保持 /kapis/resources.kubesphere.io/v1alpha3/components；member 读
/kapis/clusters/<cluster>/resources.kubesphere.io/v1alpha3/components，不用 host 代替。
列表 route 接受 type，组件/详情/关联 Pods queryKey 含 cluster；六类分类共用 componentGroups.ts，
匹配 namespace，清除分类回全量。现有三列、健康口径及排序保留。
