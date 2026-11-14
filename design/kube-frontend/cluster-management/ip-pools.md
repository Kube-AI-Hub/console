# IP 池（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/ip-pools.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-03

## 概述

集群级只读页面：`ippools.network.kubesphere.io` 的列表与详情。

## 系统现状

老 console 在集群导航「网络 › Pod IP 池」，列表列为名称/网段/已用地址/工作空间，详情三个页签
（属性、工作空间、容器组）。迁移计划此前把它登记为「network 模块未开启，不做」——**这条是错的**：
`configz.network=false` 只控制菜单，`network.kubesphere.io` 组照常服务，`/apis/.../ippools` 与
kapis 资源代理都返回 200（实测）。

## 仓库落点

- `packages/api-client/src/network.ts`（`ipPoolsApi`）
- `apps/console-next/src/pages/cluster/IpPoolsPage.tsx` / `IpPoolDetailPage.tsx`
- `routes/kube-frontend.clusters.$cluster/ippools/{route,index,$name}.tsx`

## 对外契约

`GET /kapis/resources.kubesphere.io/v1alpha3/ippools?cluster=<c>`（集合）与 `/<name>`（对象）。

字段映射：`spec.cidr`、`spec.rangeStart/rangeEnd`、`status.capacity`、`status.allocated`
（旧版写 `status.used`，两者都读）、`status.workspaces`（映射而非数组）、
标签 `kubesphere.io/workspace` 与 `ippool.network.kubesphere.io/default`。

## 设计目标与非目标

目标：把「网段还剩多少、分配给了谁」一次说清。非目标：创建/删除池、地址级明细。

## 关键约束

- **容量未知 ≠ 0**：控制器未同步时 `status.capacity` 缺失，页面显示 `-` 或只显示已用，绝不显示 `0 / 0`。
- `status.workspaces` 是 `{workspace: {allocations}}` 映射，条目顺序不稳定，按分配数降序排列。
- 容器的 pod 归属用标签 `ippool.network.kubesphere.io/name` 的 fieldSelector，不拉全量再过滤。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-IP_POOLS-01 — 详情页内嵌 pod 列表，而不是"带筛选参数的链接"

**为什么**：集群容器组页不支持 `fieldSelector` 入参，链接成 `?fieldSelector=...` 点了什么都不会发生——
「能点就不能无效」。内嵌一个最多 20 行的列表，是真的筛选。

**被否方案**：给容器组页加通用 fieldSelector 搜索参数。代价是给一个通用页面加一个只有本页用的开关。

**何时重新考虑**：出现第三个需要按标签筛容器组的页面。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-02 — 只读

**为什么**：IP 池由网络插件（calico/CNI）管理，控制台改它容易与插件状态不一致；老 console 也只读。

## 不变量

1. 容量未知时不渲染 `0 / 0`。
2. 工作空间为空时显示 `-`，不回退成 `public`。

## 已知坑

- `status.workspaces` 的值可能是数字也可能是对象，两种都要读。
- 默认池标记是**标签存在**即为真（值可能是空串），不能按 `== 'true'` 判断。

## 测试与可观测

`tests/kube-frontend/cluster-management/test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_IP_POOLS_01.py`：
列表（空态/有数据）、详情字段、pod 区域。

## 后续改进

- 地址级分配明细。
- 与节点用量页联动。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01`
