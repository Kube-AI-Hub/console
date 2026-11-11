# 修改角色 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/role.md`](../../../prd/kube-frontend/serviceaccounts/role.md)。

## 概述

`ServiceAccountRoleDialog` 预选当前角色，选项来自 `useProjectRoles()`；提交调用 `serviceAccountsApi.setRole()`，后者发出单字段 merge patch。列表与详情都打开同一个弹窗。

## 关联需求

- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-ROLE-01`

## 设计目标与非目标

**目标**：只改一个注解；选项与项目一致；失败可见。

**非目标**：RoleBinding 管理、集群角色。

## 关键约束

- 请求：`PATCH /api/v1/namespaces/{ns}/serviceaccounts/{name}`，`content-type: application/merge-patch+json`，body `{"metadata":{"annotations":{"iam.kubesphere.io/role":"<role>"}}}`。
- 清空角色写入空字符串（与老控制台一致）。
- 角色列表 `limit=-1`，按名称排序。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01 — 使用接口层 `setRole()`，页面不拼 patch 体

**为什么**：patch 的媒体类型与 body 形状是契约的一部分；把它放在 `api-client` 里，可被单测覆盖（`packages/api-client/test/serviceaccounts.test.ts` 断言 `PATCH` + 媒体类型），页面只负责交互。

**被否方案**：页面直接 `api.patch({ body: {...} })`。契约会分散在多个页面（列表、详情），漏改一处就会出现 415。

**被否方案**：PUT 整对象。与 L2 技术方案中「角色变更是注解 patch」的决策冲突。

## 系统现状

老控制台 `Modals/ModifyServiceAccountRole` + `serviceaccount.role.edit` 动作，`store.patch(detail, data)`。

## 仓库落点

| 层 | 路径 |
|---|---|
| 弹窗 | `apps/console-next/src/pages/serviceaccounts/ServiceAccountRoleDialog.tsx` |
| 接口 | `packages/api-client/src/serviceaccounts.ts`（`setRole`） |
| 查询 | `apps/console-next/src/pages/serviceaccounts/queries.ts`（`useSetServiceAccountRole`、`useProjectRoles`） |

## 对外契约

见 L2 技术方案「端点」表格中「改角色」一行。

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01** — 改角色请求体只含 `metadata.annotations` 的一个键。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01** — 项目角色列表的 `description` 是 i18n key，直接显示会露出原始 key（用例的未翻译 key 断言会失败）。
  处置：只显示角色名（见 L2 技术方案中「角色说明只显示角色名」的决策）。
- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-02** — 「全部项目」视图下若用当前筛选的项目去查角色，列表里其他项目的角色名不会被提供。
  处置：弹窗的角色查询使用**该行对象**的 `namespace`。

## 测试与可观测

- 单元：`packages/api-client/test/serviceaccounts.test.ts`（patch 形状与媒体类型）。
- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01`。

## 后续改进

角色说明文案（需要产品提供措辞，见 L2 技术方案最后一条决策）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01`
