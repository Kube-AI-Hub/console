# 服务账户列表 · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/list.md`](../../../prd/kube-frontend/serviceaccounts/list.md)。

## 概述

`ServiceAccountsPage` 用 `ResourceList` 渲染五列：名称、项目、角色、保密字典、创建时间。保密字典列把 `secrets[]` 的每个名称渲染成指向该对象自己项目下保密字典详情的链接。

## 关联需求

- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-LIST-01`
- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-LIST-02`

## 设计目标与非目标

**目标**：角色与令牌一眼可见；令牌可直达详情；缺失信息留空而非占位。

**非目标**：列表内展示令牌内容、列显隐设置。

## 关键约束

- `role` 空时渲染空字符串（不是 `-` 或「无」）。
- 令牌链接的项目取 `row.namespace`，而不是当前筛选的项目——「全部项目」视图下两者可能不同。
- 排序键 `name` / `createTime`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01 — 令牌链接指向对象自己的项目

**为什么**：跨项目视图下列表会包含多个项目的对象。若用当前筛选的项目拼链接，点进去是另一个项目里同名或不存在的东西。

**被否方案**：链接到保密字典列表并带搜索参数。多一次跳转，且不保证目标存在时给出明确提示。

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02 — 角色列在 `lg` 以下折叠

**为什么**：窄屏优先保证名称与令牌；角色在详情页仍可见。与保密字典的类型列同一断点，保持三页一致。

**被否方案**：在移动端用徽标展示角色。角色名长度不可控（`project-admin`、`custom-role-...`），徽标会挤压名称。

## 系统现状

老控制台 `pages/projects/containers/ServiceAccounts/index.jsx` 提供同样的四列（无「项目」列），本页新增项目列以支持跨项目视图。

## 仓库落点

| 层 | 路径 |
|---|---|
| 页面 | `apps/console-next/src/pages/serviceaccounts/ServiceAccountsPage.tsx` |
| 映射 | `packages/api-client/src/serviceaccounts.ts`（`toServiceAccountSummary`） |
| 列表状态 | `apps/console-next/src/components/resource/useResourceListState.ts` |

## 对外契约

`GET /kapis/resources.kubesphere.io/v1alpha3[/clusters/{c}]/namespaces/{ns}/serviceaccounts?page&limit&sortBy&ascending&name`

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01** — 令牌链接的路径项目段等于该行对象的 `metadata.namespace`。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01** — `secrets` 字段在旧对象上可能是 `null` 而不是缺失；对 `null` 调 `.map` 会抛错。
  处置：`toServiceAccountSummary` 用 `item.secrets ?? []`。

## 测试与可观测

- 单元：`test/serviceaccounts-page.test.tsx`（角色空渲染、令牌链接）。
- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01..02`。

## 后续改进

令牌列在超过三条时折叠为「N 个令牌」并展开。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01`
- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02`
