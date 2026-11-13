# 版本历史与回滚（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/revisions.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01

## 概述

部署详情中的版本表与回滚操作。

## 设计目标与非目标

目标：当前版本与可回滚版本分明；回滚可逆、不破坏历史。非目标：版本 diff。

## 关键约束

- 版本 = Deployment 拥有的 ReplicaSet；版本号在注解里。
- 没有回滚 API，只有对 Deployment 模板的 patch。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-REVISIONS-01 — 回滚实现为「把旧 ReplicaSet 的模板写回」

**为什么**：Kubernetes 没有 rollback 端点。`kubectl rollout undo` 做的事就是取得目标版本的 pod template，写回 Deployment 的 `spec.template`。实现照此办理，并且**不修改** Deployment 自身的 `revision` 注解——于是回滚会生成一个新版本，而不是抹掉它来自的那条历史。

**被否方案**：修改 `revision` 注解回退。那会让历史出现"回退"，而 Kubernetes 本身从不这样做。

**何时重新考虑**：平台提供回滚接口时。

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-REVISIONS-02 — 当前版本不提供回滚按钮

**为什么**：对当前版本回滚是一次空操作（模板写回自己），但它会重启所有 Pod。一个"看不出效果却滚动重启"的按钮比没有按钮更危险。

**被否方案**：提供按钮并提示"回滚到当前版本"。同样是空操作。

**何时重新考虑**：需要"强制重新部署当前版本"时——那已由「重新部署」提供。

## 系统现状

老 console 的部署详情有 RevisionControl 区块，提供版本列表与回滚；本模块的列与行为与之对应。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx`（版本表）
- `packages/api-client/src/workloads.ts` 的 `revisions` / `rollback` / `toWorkloadRevision`

## 对外契约

读 `apps/v1` 的 deployments 与 replicasets（按标签选择器过滤，再按 ownerReference 确认归属）；写 `PATCH deployments/<name>` 的 `spec.template`。

## 不变量

1. 版本号降序。
2. 当前版本不回滚。
3. 回滚不改 Deployment 的版本注解。

## 已知坑

- ReplicaSet 的标签选择器可能与 Deployment 的 selector 相同，必须再用 `ownerReferences` 确认归属，否则会把别的部署的版本列进来。
- 模板里的 `metadata.creationTimestamp` 是控制器写的，直接回写会让 patch 与控制器争同一字段。

## 测试与可观测

E2E 见 `tests/kube-frontend/app-workloads/`。

## 后续改进

版本之间的差异对比。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01`
