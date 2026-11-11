# 服务账户 · 智能体可操作性 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/ai-surface.md`](../../../prd/kube-frontend/serviceaccounts/ai-surface.md)。

## 概述

与保密字典相同的契约，额外为 kubeconfig 文本与遮挡开关提供按 Secret 名区分的句柄。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01`

## 设计目标与非目标

**目标**：kubeconfig 可被一次属性读取拿到；遮挡状态可读。

**非目标**：暴露集群操作能力。

## 关键约束

- 列表 `serviceaccounts`、详情 `serviceaccount-detail` 前缀。
- kubeconfig 句柄 `serviceaccount-detail:kubeconfig:<secret>`，遮挡开关 `serviceaccount-detail:toggle:<secret>`（`aria-pressed`）。
- 复制/下载句柄 `serviceaccount-detail:copy-kubeconfig:<secret>`、`serviceaccount-detail:download-kubeconfig:<secret>`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01 — kubeconfig 文本本身是句柄，而不是「点击下载」

**为什么**：智能体需要一个可读的字符串；模拟下载再解析文件既慢又依赖浏览器下载目录。

**被否方案**：只在复制按钮上提供句柄。复制会写剪贴板，副作用不该由只读者触发。

## 系统现状

配置字典与保密字典已建立约定；本页沿用。

## 仓库落点

| 层 | 路径 |
|---|---|
| manifest | `apps/console-next/src/pages/serviceaccounts/queries.ts`（`serviceAccountsPage`） |
| 句柄 | `pages/serviceaccounts/*.tsx`、`ServiceAccountSecretsSection.tsx` |

## 对外契约

| 句柄 | 位置 |
|---|---|
| `serviceaccounts:surface` | 列表区域（四态） |
| `serviceaccounts:search` / `:create` / `:bulk-delete` / `:retry` | 工具条 |
| `serviceaccounts:select:<name>`、`serviceaccounts:open:<name>` | 行 |
| `serviceaccounts:open-secret:<secret>` | 令牌链接 |
| `serviceaccount-detail:surface` | 详情区域（四态） |
| `serviceaccount-detail:kubeconfig:<secret>` | kubeconfig 文本 |
| `serviceaccount-detail:toggle:<secret>` | 遮挡开关 |
| `serviceaccounts:role-select`、`:role-submit` | 角色弹窗 |

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01** — kubeconfig 句柄存在于每一个有令牌 Secret 的块中。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01** — 句柄里直接拼 Secret 名，若名称含特殊字符会破坏选择器；K8s 名称只允许 `[a-z0-9-.]`，当前安全。
  处置：记录该前提；若未来允许其他字符，改为按索引并另附名称属性。

## 测试与可观测

- 契约：`config/ai-surface-contract.test.ts`。
- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01`。

## 后续改进

manifest 与句柄一致性自动断言。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01`
