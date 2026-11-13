# 集群日志收集 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/log-collections.md)

## 概述

只读展示日志收集器、输入与输出；收集器健康由其 Pod 推导。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01

## 设计目标与非目标

目标：一屏回答「采集是否在跑、收什么、写哪」。非目标：编辑管道、日志检索。

## 关键约束

- `/apis/logging.kubesphere.io/v1alpha2/{fluentbits,inputs,outputs}`（kapis 无聚合，实测 404）。
- Pod：`/api/v1/namespaces/<ns>/pods?labelSelector=app.kubernetes.io/name=fluent-bit`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01 — 健康度取自 Pod，不取 CR status

**为什么**：本集群的 FluentBit CR `status` 是空对象（实测），直接渲染会显示一个恒为「未知」的徽标，等于没有信息。收集器自有 Pod 的 Running 数才是「采集是否真的在跑」。
**被否方案**：用 `status.conditions`。该字段不存在，代码会永远走兜底分支。
**何时重新考虑**：operator 开始上报 conditions 时（届时两者都显示）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02 — 直接读 CR，不走 kapis

**为什么**：`/kapis/logging.kubesphere.io/v1alpha2/*` 在本集群全部 404，而 `/apis/logging.kubesphere.io/v1alpha2/*` 正常返回。硬等聚合接口会把一个可用页面卡成不可用。
**被否方案**：等 kapis 修复。
**何时重新考虑**：聚合接口可用时（届时可减少一次标签查询）。

## 系统现状

老 console 的集群日志收集是「开关 + 采集配置 + 输出配置」的可编辑页；本页只读地展示同一批对象。编辑按明确不做登记。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterLogCollectionsPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/log-collections/`
- 接口：`packages/api-client/src/iam.ts` 的 `clusterLoggingApi`
- 区域注册：`areas/registry.ts`（集群设置分组）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 收集器 | /apis/logging.kubesphere.io/v1alpha2/fluentbits |
| 输入 | /apis/logging.kubesphere.io/v1alpha2/inputs |
| 输出 | /apis/logging.kubesphere.io/v1alpha2/outputs |
| 收集器 Pod | /api/v1/namespaces/&lt;ns&gt;/pods?labelSelector=app.kubernetes.io/name=fluent-bit |

## 不变量

1. 三区条数与对应 CR 条数一致。
2. 就绪 Pod = Running / 总数。
3. 任一区块读失败只影响该区块。

## 已知坑

- **CR status 为空**：不要据此判断健康。
- **kapis 404**：日志 CR 只在 `/apis` 下，走 kapis 会得到「页面永远空」。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01.yaml`
可观测点：`cluster-log-collections:surface`、`:collectors`、`:inputs`、`:outputs`。

## 后续改进

- 收集器/输出编辑（需要独立校验流程）。
- 日志检索（工具箱）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01