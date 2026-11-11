# 服务账户 · 智能体可操作性（L3）

## 概述

与服务账户页一致地发布 `data-ai-state`、`data-ai-id`、`data-ai-row`，并把动作登记进 manifest（`serviceaccounts:search`、`serviceaccounts:create`、`serviceaccounts:row-select`、`serviceaccounts:bulk-delete`）。此外，**复制 kubeconfig** 与 **切换明文** 也有稳定句柄，因为它们改变「机器能读到什么」。

## 用户故事

### US1 - 作为智能体，拿到某个服务账户的 kubeconfig 全文

**Independent Test**：打开详情，读取 `serviceaccount-detail:kubeconfig:<secret>` 元素的文本，即为完整 kubeconfig。

### US2 - 作为智能体，识别列表四态并批量删除

**Independent Test**：读取 `serviceaccounts:surface` 状态；勾选两行后点 `serviceaccounts:bulk-delete`，按提示输入两个名称后确认。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01** — Given 打开服务账户列表与详情，Then `serviceaccounts:surface` 与 `serviceaccount-detail:surface` 的 `data-ai-state` 为四态之一；每行带 `data-ai-row`；`serviceaccounts:bulk-delete` 带 `data-ai-needs="serviceaccounts:row-select"`；详情中存在 `serviceaccount-detail:kubeconfig:<secret>` 与 `serviceaccount-detail:toggle:<secret>`，后者 `aria-pressed` 初始为 `false`。

## 设计目标

- 让「获取 kubeconfig」成为一次属性读取，而不是模拟点击下载再解析文件。

## 约束与边界

- 句柄前缀：列表 `serviceaccounts`，详情 `serviceaccount-detail`。
- ai-kit 的 `Select` 不透传属性，角色选择器的句柄由包裹的 `AiSurface` 提供（`serviceaccounts:field-role`、`serviceaccounts:role-select`）。

## UI 交互设计

- 写操作失败在 `resource-mutation-error` 中展示，不改变列表状态。

## 文案与校验

- manifest 中的 action id 必须与页面上的句柄一致。

## 边界情况

- 详情中多个令牌：句柄按 Secret 名区分，不依赖顺序。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01** — 详情必须为每个令牌提供可读的 kubeconfig 句柄。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01** — 契约测试覆盖新增页面，句柄清单与本文一致。

## 明确不做

- 不暴露「在集群中执行命令」的能力。

## 假设

- 智能体可以读取 DOM 文本内容。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01`
