# 删除配置字典（L3）

## 概述

行内删除与批量删除。两者共用同一条失败处理路径。

## 用户故事

### US1 - 作为项目成员，删除一条不再使用的配置

**Independent Test**：点击某行的「删除」，确认后该行消失；`kubectl get configmap <name>` 返回 NotFound。

### US2 - 作为项目成员，一次清理多条配置

**Independent Test**：勾选两行，「批量删除」由禁用变为可用并显示数量，确认后两行都消失。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01** — Given 列表已加载，When 未选中任何行，「批量删除」保持禁用且带 `data-ai-needs="configmaps:row-select"`；勾选一行后变为可用并显示 `(1)`。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02** — Given 已选中若干行，When 确认删除且上游成功，Then 列表重新拉取，已选项清空；When 上游失败，Then 页面显示可读错误且不静默吞掉。

## 设计目标

- 删除是破坏性操作：必须确认，且确认框对人工与智能体同样生效。
- 批量删除逐个执行：上游无事务，并行会掩盖部分失败。

## 约束与边界

- 依赖 kapis 的 `DELETE .../configmaps/:name`。
- 删除后不本地移除行，而是失效列表查询：以服务端结果为准，部分失败才不会显示成全部成功。

## UI 交互设计

- 行内删除为次要操作（ghost），批量删除为危险操作（danger）。
- 未选中时批量按钮禁用，并带 `data-ai-needs`，让智能体知道缺哪一步。
- 失败时在列表下方显示 `role="alert"` 的一行错误。

## 文案与校验

- 单条确认：确认删除该配置字典？
- 批量确认：确认删除所选配置字典？
- 失败文案取上游 `message`，无可读信息时回落到「未知错误」。

## 边界情况

- 未选中时点击批量删除：按钮禁用，不会发出请求。
- 删除过程中重复点击：按钮在 `isPending` 期间禁用。
- 部分成功：已成功的行在下一次拉取后消失，失败信息保留。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01** — 批量删除在未选中时必须禁用。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02** — 删除必须确认，成功后重新拉取列表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01** — 删除后 `kubectl get` 返回 NotFound。

## 明确不做

- 不做软删除与回收站。
- 不做删除单个键。

## 假设

- 权限不足时上游返回 403，BFF 归一为 `forbidden`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02`
