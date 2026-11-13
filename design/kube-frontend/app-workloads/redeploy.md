# 重新部署（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/redeploy.md)

## 概述

重新部署 = 给 Pod 模板打 `kubectl.kubernetes.io/restartedAt` 注解。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01`
- `prd/kube-frontend/app-workloads/redeploy.md`

## 设计目标与非目标

让「重启」在页面上是一等操作，同时不破坏对象的其他字段。非目标：不做暂停/恢复滚动。

## 关键约束

- merge patch，只写一个注解。
- 仅三种控制器提供该操作（描述符 `allowRedeploy`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01 — 用注解而不是重建对象

**为什么**：`kubectl rollout restart` 就是这么做的：模板 hash 变化，控制器自己滚出新 ReplicaSet。重建对象会丢历史与滚动策略，还会短暂中断服务。

**被否方案**：删除所有 Pod 让控制器重建。绕过了滚动更新策略（maxUnavailable 等），在生产上是危险动作。

**何时重新考虑**：Kubernetes 提供原生 restart 子资源时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-02 — 先弹加载框，再等结果

**为什么**：写请求在真实集群上要几秒。点完没有任何反馈，用户会以为按钮坏了并重复点击，触发多次滚动。

**被否方案**：按钮自己转圈。按钮小、容易被忽略，且用户看不到「正在重启哪个对象」。

**何时重新考虑**：请求稳定在 300 ms 以内时，可以只用按钮 pending。

## 系统现状

老 console 通过 `workload.redeploy` 弹窗做同样的事。

## 仓库落点

- `packages/api-client/src/workloads.ts` 的 `restart()`
- `pages/app-workloads/WorkloadDetailPage.tsx`

## 对外契约

`PATCH …/<resource>/<name>`，`content-type: application/merge-patch+json`，body 只含 `spec.template.metadata.annotations`。

## 不变量

- 除该注解外对象不变。
- 成功后 revision 递增。

## 已知坑

- 用 PUT 而不是 PATCH 会覆盖并发修改；必须 merge patch。
- 注解键必须与 kubectl 一致，否则 `kubectl rollout status` 看不到这次重启。

## 测试与可观测

- E2E 轮询注解出现（`TC-…-REDEPLOY-01`）。

## 后续改进

- 重启历史与回滚。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01`
