# 删除保密字典 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/delete.md`](../../../prd/kube-frontend/secrets/delete.md)。

## 概述

共享 `DeleteDialog` 负责「输入名称确认」，页面负责调用 `useDeleteSecrets` 与刷新。单条与批量共用组件，`names` 长度决定文案与确认串。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-DELETE-01`

## 设计目标与非目标

**目标**：确认串必须精确匹配；删除后以服务端为准刷新；部分失败可解释。

**非目标**：回收站、引用检查。

## 关键约束

- 确认串为 `names.join(', ')`（逗号加空格，与老控制台 `Modals/Delete` 一致）。
- 每次打开清空输入。
- 删除串行执行（`resourceApi.remove` 内部 for-of），保证部分失败可复现。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-DELETE-01 — 三个资源共用一个删除弹窗

**为什么**：确认规则、文案模板、按钮状态完全一致；三个实现会出现「配置字典要输入名称、保密字典只要点一下」这种不一致，而它们删除的后果相同。

**被否方案**：每个资源各自实现。已经出现过一次在两个页面之间复制粘贴弹窗、其中一处忘记清空输入的问题。

### DEC-L3-KUBE-FRONTEND-SECRETS-DELETE-02 — 删除后失效查询而不是本地移除

**为什么**：与配置字典 DEC-FULL-…-02 相同：批量删除没有上游事务，本地移除会把部分失败显示成全部成功。

**被否方案**：乐观更新。会在失败时闪回，且需要处理分页边界。

## 系统现状

老控制台 `resource.delete` / `resource.batch.delete` 使用 `components/Modals/Delete`（输入名称确认）。

## 仓库落点

| 层 | 路径 |
|---|---|
| 弹窗 | `apps/console-next/src/components/resource/DeleteDialog.tsx` |
| 请求 | `apps/console-next/src/pages/secrets/queries.ts`（`useDeleteSecrets`） |
| 路由跳转 | `routes/...secrets.$name.tsx`（详情删除后跳回列表） |

## 对外契约

`DELETE /api/v1/namespaces/{ns}/secrets/{name}`，批量时逐条发送。

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-DELETE-01** — 未输入精确确认串时确认按钮始终禁用。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-DELETE-01** — 输入框未重置时，上一次删除的确认串会直接满足下一次。
  处置：`useEffect` 在 `open` 或 `expected` 变化时清空。

## 测试与可观测

- 单元：`test/resource-dialogs.test.tsx`（`expectedConfirmation`、禁用逻辑）。
- 端到端：`TC-L3-KUBE-FRONTEND-SECRETS-DELETE-01`。

## 后续改进

批量删除的结果汇总（成功 N 条、失败 M 条）需要上游支持逐条返回，当前只显示第一条错误。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-DELETE-01`
