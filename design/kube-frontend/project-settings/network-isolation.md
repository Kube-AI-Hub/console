# 网络隔离（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/network-isolation.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-03

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01
- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02

## 概述

项目级隔离开关与 NetworkPolicy 列表同屏。

## 设计目标与非目标

目标：意图与执行放在一起看。非目标：策略编辑。

## 关键约束

- 开关读 resources 代理、写核心组 merge patch。
- 策略读 `networking.k8s.io/v1`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK-ISOLATION-01 — 开关只改一个注解

**为什么**：命名空间上还有标签与别的注解（企业空间归属就在标签里）。用 PUT 会整体替换，可能丢掉它们；merge patch 只动 `kubesphere.io/network-isolate`。

**被否方案**：PUT 整个命名空间。一次开关操作就可能把项目从企业空间里摘出来。

**何时重新考虑**：平台提供专门的项目隔离接口时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK-ISOLATION-02 — 开关与策略列表同屏

**为什么**：管理员的问题是「这条流量为什么不通」。只看策略看不到项目级意图，只看开关看不到具体范围，两者放一页才能回答。

**被否方案**：拆成两个页面。会让同一问题需要跳转两次。

**何时重新考虑**：策略数量增长到需要独立的创建/编辑流程时。

## 系统现状

老 console 的网络隔离页也是开关 + 策略列表；本模块列一致（名称、类型、规则数、创建时间）。

## 仓库落点

- `apps/console-next/src/pages/settings/NetworkIsolationPage.tsx`
- `packages/api-client/src/iam.ts` 的 `networkIsolationApi` / `networkPoliciesApi`
- `src/routes/.../networkpolicies/`

## 对外契约

读 `resources.kubesphere.io/v1alpha3/namespaces/<ns>` 与 `networking.k8s.io/v1`；写 `PATCH /api/v1/namespaces/<ns>`。

## 不变量

1. 开关只改一个注解。
2. 注解缺失等同于关闭。

## 已知坑

- 命名空间的注解与标签同处 `metadata`，写错层级会 422。
- 策略的 `policyTypes` 为空数组时按 `-` 显示，不猜测。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`。

## 后续改进

策略创建与编辑。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01`

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-NETWORK-ISOLATION-03 — peer 必须包一层 `podSelector`

**为什么**：Kubernetes 的 peer 是**包裹选择器的对象**：`from: [{ podSelector: { matchLabels: … } }]`。把选择器直接放进 `from` 会被拒绝——实测 422 `spec.ingress[0].from[0]: Required value: must specify a peer`。这个错误信息没有说清楚"要包一层"，所以记录下来。

**被否方案**：`from: [{ matchLabels: … }]`。看起来更短，实际不合法。

**何时重新考虑**：支持 `namespaceSelector` 与 `ipBlock` 时需要扩展 peer 结构。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-NETWORK-ISOLATION-04 — 一次只有一条规则

**为什么**：管理员在此页的实际动作是"隔离这个项目，再放行一个邻居"。单条规则覆盖它；多规则与 CIDR 更适合 YAML。

**被否方案**：完整的规则编辑器（多条 + 端口 + 命名空间选择器）。工作量数倍，而使用频率低。

**何时重新考虑**：出现"策略全靠界面配置"的需求时。
