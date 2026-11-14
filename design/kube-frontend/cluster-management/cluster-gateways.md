# 集群网关（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-gateways.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01

## 概述

ClusterGatewaysPage 共用两视图表格，clusterGatewaysApi 读取原生集合，
toClusterGateway 复用已有 toProjectGateway 的控制器就绪映射。

## 系统现状

老版 gateways/cluster 与 gateways/project 是两个视图；新 UI 原来只有项目网关页。
本轮补集群入口及两个列表，保留真实状态；写能力和下钻监控仍登记为缺口。

## 仓库落点

- `apps/console-next/src/pages/cluster/ClusterGatewaysPage.tsx`
- `src/routes/kube-frontend.clusters.$cluster/gateways/{route,index,$component}.tsx`
- `packages/api-client/src/gateways.ts`

## 对外契约

GET `/apis/gateway.kubesphere.io/v1alpha1/gateways`，成员集群沿用 clusters 段。
原生 List 的 items 为全部对象，无 totalItems 不渲染分页。
句柄：`cluster-gateways:surface`、`:search`、`:refresh`、`:tab:cluster`、`:tab:project`。

## 设计目标与非目标

目标：集群入口、作用域区分与真实状态。非目标：安装控制器、集群写操作与网关监控。

## 关键约束

- 状态来自 Deployed=True，不以 spec.replicas 判断就绪。
- Gateway 读取错误必须抛出，不能吞掉异常返回空列表。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01 — 原生 List 只读盘点，不模拟分页或就绪

**为什么**：B200 服务 Gateway CRD 但控制器 chart 缺失；对象可读不表示底层网关就绪。
读取全集按作用域过滤并共享列表组件，比伪分页或创建一个不会部署成功的对象更符合数据事实。

**被否方案**：因控制器不完整而隐藏整个入口；这会丢失状态排障能力。吞掉接口错误显示暂无网关会误导管理员。

**何时重新考虑**：控制器安装完整并能验证部署、禁用、日志和监控后，迁移剩余写能力及下钻页。

## 不变量

1. 默认 cluster 视图，project 视图链接到所属项目的网关页。
2. 只有 Deployed=True 显示就绪；地址缺失显示 -。
3. 不给无总数的原生 List 配置分页器。

## 已知坑

- 集群网关和项目网关共享 Gateway CRD，区别不能用“有无对象”猜测。
- 原项目 Gateway API 吞掉读取异常，不能复用它的 get 作为集群错误判定。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`：读取真实集合，核对两视图数量与 URL。
映射和查询单测覆盖 Deployed 条件、集群归属、空列表与错误不吞掉。

## 后续改进

集群写操作、网关详情监控和日志；环境就绪前不能把这些能力登记为已迁移。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01`
