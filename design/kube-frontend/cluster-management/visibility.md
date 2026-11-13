# 集群可见性 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/visibility.md)

## 概述

一个标签的读写：`cluster.kubesphere.io/visibility`（public / private，缺省 private）。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01

## 设计目标与非目标

目标：只改一个标签；选择即时反馈。非目标：企业空间授权管理。

## 关键约束

- 读 `/kapis/cluster.kubesphere.io/v1alpha1/clusters/<name>`（与概览、设置同源）。
- 写 `/apis/cluster.kubesphere.io/v1alpha1/clusters/<name>`，`application/merge-patch+json`，只含 `metadata.labels`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-VISIBILITY-01 — 可见性是标签，不是 CR

**为什么**：平台读的就是这个标签。另建状态会与平台不一致，而这种不一致只在企业空间列表缺集群时才被发现。

**被否方案**：用联邦工作空间对象表达可见性。那是授权（谁能用），不是可见性（谁能看见）。

**何时重新考虑**：平台改为用 CR 表达可见性时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-VISIBILITY-02 — 选择先本地生效，失败再回退

**为什么**：单选状态若完全由查询派生，点击后要等 refetch 才变化，看起来像「点了没反应」。本地先记下选择，失败时回退到存储值——与项目日志收集开关同样的处理。

**被否方案**：等服务器返回再更新。慢一拍的控件会被当成故障。

**何时重新考虑**：需要批量切换多个集群时（那时要有明确的批量状态）。

## 系统现状

老 console `pages/clusters/containers/Visibility`：面板显示当前可见性，表格列出企业空间并可从弹窗调整。本页迁移「公开/私有」部分；企业空间授权列表未迁移（需要联邦工作空间资源），页面上据实说明。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterVisibilityPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/visibility/`
- 接口：`packages/api-client/src/cluster.ts` 的 `clusterWriteApi.setVisibility`、`ClusterDetail.visibility`
- 文案：`packages/locales/src/index.ts`（`cluster.visibility.*`）

## 对外契约

| 用途 | 路径 | 方法 |
| --- | --- | --- |
| 读 | /kapis/cluster.kubesphere.io/v1alpha1/clusters/<name> | GET |
| 写 | /apis/cluster.kubesphere.io/v1alpha1/clusters/<name> | PATCH（merge-patch+json） |

## 不变量

1. 只写 `cluster.kubesphere.io/visibility` 一个标签。
2. 标签缺失按 private 处理。
3. 保存失败时回退到存储值。

## 已知坑

- **是标签不是注解**：写错位置页面看起来一样，平台不读。
- **merge patch 会保留其它标签**：用 PUT 会丢 `kubesphere.io/workspace` 与角色标签。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01.yaml`
可观测点：`cluster-visibility:surface`、`cluster-visibility:panel`、`cluster-visibility:public`、`cluster-visibility:private`。

## 后续改进

- 企业空间授权列表（需要联邦工作空间资源）。
- 与集群列表的可见性标签联动筛选。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01
