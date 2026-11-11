# 修改角色（L3）

## 概述

项目角色存在注解 `iam.kubesphere.io/role` 上，决定该服务账户在项目内的权限。老控制台为它单独做了弹窗（`Modals/ModifyServiceAccountRole`），行操作与详情都提供「修改角色」。

本页用 **注解 patch** 修改（`application/merge-patch+json`），而不是整对象 PUT——`secrets[]` 等字段由控制器维护，整对象写回会与之竞争。

## 用户故事

### US1 - 作为项目成员，把账户从 viewer 提升为 editor

**Independent Test**：行操作「修改角色」→ 选择 `project-editor` → 确认；列表与详情的角色变为 `project-editor`，其他注解不变。

### US2 - 作为项目成员，清空角色

**Independent Test**：选择「不设置」→ 确认；注解变为空字符串，列表角色列变空。

## 验收场景

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-ROLE-01** — Given 一条带角色的服务账户，When 打开「修改角色」，Then 选择器预选当前角色且选项来自该项目的角色列表；When 选择另一个角色并确认，Then 请求为 `PATCH` 且 `content-type: application/merge-patch+json`，`metadata.annotations['iam.kubesphere.io/role']` 更新为新值，`secrets[]` 等其他字段不变。

## 设计目标

- 角色变更只动一个注解：最小写入面，避免与控制器竞争。

## 约束与边界

- 清空角色写入空字符串（与老控制台角色选择器提交一致），而不是删除注解键。
- 角色列表失败时选择器为空并给出提示，仍可提交当前值（不改变）。
- 目标服务账户所属项目取自列表行或详情，而不是当前筛选（「全部项目」视图下尤其重要）。

## UI 交互设计

- 弹窗标题「修改角色」，说明「为服务账户 {name} 选择新的项目角色」。
- 选择器含「不设置」选项，与创建时一致。

## 文案与校验

- 提示：角色决定该服务账户在项目内的权限……；角色列表加载失败，可直接填写角色名或稍后重试。

## 边界情况

- 角色名不在列表中（例如角色已被删除）：选择器显示当前值，确认后仍然写入——不做静默清空。
- 连续修改两次：第二次基于最新对象，因而是 patch，不存在 409。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01** — 修改角色必须以 merge patch 方式只更新角色注解。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01** — 修改后 `kubectl get sa -o json` 的差异只有该注解。

## 明确不做

- 不做 RoleBinding 的增删（只改注解）。
- 不做集群角色（`cluster-role.kubesphere.io`）。

## 假设

- 角色列表返回包含 `metadata.name`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01`
