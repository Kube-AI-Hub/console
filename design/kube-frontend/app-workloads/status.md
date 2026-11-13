# 状态派生（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/status.md)

## 概述

状态由 `packages/api-client/src/workloads.ts` 的纯函数派生，列表与详情共用。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02`
- `prd/kube-frontend/app-workloads/status.md`

## 设计目标与非目标

与老 console `console/src/utils/status.js` 逐分支一致。非目标：不引入新的中间态。

## 关键约束

- 纯函数，无 I/O；输入是对象，输出是枚举字符串。
- 服务与应用路由返回空串，由列表决定不渲染该列。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01 — 复制老规则，而不是「重新想一遍」

**为什么**：状态列是用户判断故障的第一入口。迁移期最危险的动作是「顺手改进」——一旦与命令行不一致，用户就会同时怀疑两个系统。

**被否方案**：用「就绪副本数 / 期望副本数」统一所有资源。守护进程集与任务没有 `replicas`，统一会比较错对象。

**何时重新考虑**：上游 KubeSphere 提供官方状态聚合接口时。

## 系统现状

老实现散落在 `utils/status.js` 的 `getDeployStatus` / `getDaemonSetStatus` / `getJobStatus` / `getPodStatus`。

## 仓库落点

- `packages/api-client/src/workloads.ts`
- 测试：`packages/api-client/test/workloads.test.ts`

## 对外契约

`workloadStatus(kind, item)` 与 `workloadProgress(kind, item)` 是唯一入口。

## 不变量

- 同一个对象在任何页面得到同一个状态。

## 已知坑

- 部署「缩容到 0 但旧 Pod 仍在」是 `Updating`，不是 `Stopped`。
- Pod `phase=Running` 没有 `containerStatuses` 时应为 `waiting`，否则崩溃循环会显示成健康。

## 测试与可观测

- 21 条单测逐分支覆盖（见测试文件）。

## 后续改进

- 把状态映射表搬进 i18n 之外的配置（暂不需要）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02`
