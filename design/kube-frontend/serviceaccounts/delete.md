# 删除服务账户 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/delete.md`](../../../prd/kube-frontend/serviceaccounts/delete.md)。

## 概述

复用共享 `DeleteDialog` 与 `resourceApi.remove`，确认规则与保密字典完全一致。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01`

## 设计目标与非目标

**目标**：与另外两个资源一致的确认体验；删除后以服务端为准刷新。

**非目标**：回收站、级联删除令牌。

## 关键约束

- 确认串 `names.join(', ')`；按钮 `serviceaccounts:delete-confirm`、输入 `serviceaccounts:delete-input`。
- 详情删除后跳回列表。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01 — 不代为删除令牌 Secret

**为什么**：令牌 Secret 的清理由垃圾回收控制器负责（建立在 ownerReference/CredentialProvisioningController 的历史行为之上）。前端删除它们会与控制器竞争，且可能误删用户手工挂载的 Secret。

**被否方案**：删除账户后按 `secrets[]` 逐个删除。既违反最小写入原则，也在部分失败时留下「账户没了、令牌还在」的半状态。

## 系统现状

老控制台 `resource.delete` / `resource.batch.delete`。

## 仓库落点

| 层 | 路径 |
|---|---|
| 弹窗 | `apps/console-next/src/components/resource/DeleteDialog.tsx` |
| 请求 | `apps/console-next/src/pages/serviceaccounts/queries.ts`（`useDeleteServiceAccounts`） |

## 对外契约

`DELETE /api/v1/namespaces/{ns}/serviceaccounts/{name}`。

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01** — 未输入精确确认串时不能删除。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01** — 与保密字典相同：输入未重置的问题已由共享组件解决。

## 测试与可观测

- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01`。

## 后续改进

无。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01`
