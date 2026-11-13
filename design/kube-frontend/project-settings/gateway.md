# 网关设置（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/gateway.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01

## 概述

项目网关的两态页面：空态与信息态。

## 设计目标与非目标

目标：无网关时给出可执行动作；有网关时以控制器结论为准。非目标：网关参数编辑。

## 关键约束

- 网关是 `gateway.kubesphere.io/v1alpha1` 的 Gateway，位于项目命名空间。
- 类型固定为 NodePort。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-01 — 状态读 `Deployed` 条件，不读 spec

**为什么**：实测发现控制器会把 `spec` 重写为空（`{"spec":{}}`），真正的结果写在 `status.conditions` 的 `Deployed` 里（`status: True` 表示 Helm release 安装成功）。读 spec 会得到「什么都没配置」的假象。

**被否方案**：用 `spec.type` 填充「访问方式」。字段会被控制器清空，显示为空才是事实。

**何时重新考虑**：控制器改为保留 spec 时。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-GATEWAY-02 — 未就绪时轮询而不是让用户刷新

**为什么**：部署需要几十秒到几分钟。让用户手动刷新等于把等待转嫁给他们。

**被否方案**：只在挂载时请求一次。页面会一直停在「部署中」直到用户自己刷新。

**何时重新考虑**：WebSocket 推送可用时。

## 系统现状

老 console 的网关页展示集群网关与项目网关的对应关系与访问方式；本模块提供创建、状态与删除。

## 仓库落点

- `apps/console-next/src/pages/settings/GatewayPage.tsx`
- `packages/api-client/src/storage.ts` 的 `projectGatewayApi` / `toProjectGateway`
- `src/routes/.../gateways/`

## 对外契约

读/写 `/apis/gateway.kubesphere.io/v1alpha1/namespaces/<ns>/gateways`。

## 不变量

1. 状态等于 `Deployed` 条件。
2. 无网关时一定给出创建入口。

## 已知坑

- **本集群未安装网关控制器的 Helm chart**：Gateway 对象能创建，但 `spec` 被清空、不产生 Service，状态长期停在「部署中」。因此本页只能验证到「创建与状态上报」，真正就绪需要安装控制器。
- 删除时对象带 `finalizers: uninstall-helm-release`，若未安装过 release 会停留。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`。

## 后续改进

网关类型与副本数编辑、网关日志。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01`
