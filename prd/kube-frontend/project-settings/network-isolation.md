# 网络隔离（L3）

[子模块需求](./_index.md)

## 概述

项目级开关 + 网络策略列表：开关写在命名空间注解上，列表是真正生效的 NetworkPolicy 对象。

## 用户故事

### US1 - 确认项目流量是否被限制、被什么限制 (Priority: P1)

作为 **项目管理员**，我希望 **在一个页面看到隔离开关和具体策略**，以便 **判断某条流量为什么通或不通**。

**Independent Test**：打开网络隔离页，核对开关状态与命名空间注解一致，策略数与 API 一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01** — 已知项目内有多条网络策略，当打开网络隔离页，则显示名称（副行为 Pod 选择器）、策略类型、规则数、创建时间四列，且行数与 API 返回一致。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-03** — 已知在网络隔离页，当「创建网络策略」填写名称、作用于 `app=web`、方向入站、允许对方 `role=frontend` 并确认，则生成的 NetworkPolicy 之 `spec.podSelector.matchLabels` 为 `{app: web}`、`spec.ingress[0].from[0].podSelector.matchLabels` 为 `{role: frontend}`；当删除，则该对象不存在。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02** — 已知开关处于关闭状态，当打开开关，则命名空间的 `kubesphere.io/network-isolate` 注解变为 `true`；当再次关闭，则变回 `false`。

## 设计目标

1. 开关与策略同屏，因为管理员判断的是同一件事。
2. 开关只改一个注解，不覆盖命名空间的其他字段。

## 约束与边界

- 开关读命名空间（resources 代理），写命名空间（核心组 merge patch）。
- 策略读 `networking.k8s.io/v1` 的 `networkpolicies`。

## UI 交互设计

顶部一行：说明文字 + 开关；下方是策略列表（四列）。

## 文案与校验

- 列：名称、策略类型、规则数、创建时间。
- 规则数显示为「入 n / 出 m」。
- 开关标签：开启项目网络隔离。

## 边界情况

- 没有策略时显示空态且不渲染表头。
- 开关注解缺失等同于关闭。

## 明确不做

- 策略的**编辑**（创建与删除已迁移；修改仍用 YAML）。
- 多规则策略与 IP 段（`ipBlock`）规则。
- 策略的启用/停用（NetworkPolicy 没有这个字段）。

## 假设

- KubeSphere 用命名空间注解表示项目级隔离意图。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01`
- `AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01** — 列表展示四列，策略类型以徽标呈现。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02** — 开关写入命名空间注解。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01** — 策略名称集合与 `kubectl get networkpolicy -n <ns>` 一致。
