# 企业空间用户组（L3）

[子模块需求](./_index.md)

## 概述

企业空间控制台的 **用户组** 页：`/kube-frontend/workspaces/<ws>/user-groups`。它列出该企业空间的 IAM Group 及其成员数、描述，回答「这个空间里有哪些用户组、每个组有多少人」。

KubeSphere 的 Group 是**集群级** IAM 对象，靠 `kubesphere.io/workspace` label 归属企业空间；成员关系不在 Group 上，而在 `GroupBinding`（`groupRef.name` + `users`）。所以页面读两个集合再合并：组列表 + 该空间的全部绑定。

## 用户故事

### US1 - 企业空间管理员看用户组规模 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到该空间全部用户组及每个组的成员数**，以便 **判断哪些组该维护、哪些组没人**。

**Independent Test**：打开 `/workspaces/<ws>/user-groups`，核对行数等于该空间 `groups` 接口的 `totalItems`；某一组行的成员数等于全部 `groupbindings` 中 `groupRef.name` 指向它的 `users` 长度之和。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 已知企业空间内有 G 个用户组（G 可能为 0），当打开该空间用户组页，则列出 G 行，每行显示组名（别名优先，否则 `generateName`）、成员数与描述；成员数等于绑定中该组的用户数之和；G 为 0 时显示空态；接口失败时显示错误面板与重试。

## 设计目标

1. 成员数在列表上直接可见，不用逐组点进去数人。
2. 作用域正确：只显示该企业空间 label 下的组，不混入其他空间。
3. 不伪造字段：Group 类型没有 description，描述列读平台约定的 `kubesphere.io/description` 注解，没有就显示 `-`。

## 约束与边界

- 只读：用户组的创建/编辑/删除、成员的加入/移出是写路径，不在本页。
- 两个集合都一次取全（`limit=-1`），前端分页，页大小 20；成员数在客户端 join。
- 一次绑定可能含多个用户，多个绑定可能指向同一组，成员数按并集求和（本实现按绑定累加；KubeSphere 的绑定模型一组一绑定）。

## UI 交互设计

- 页面头：标题「用户组」、描述「该企业空间的用户组与成员。」
- 表：组名 / 成员 / 描述；成员数右对齐等宽数字。
- 组名单元格：主行是别名（有则用），次行是对象名（与主行不同才显示）。
- 超过 20 行时出现分页器。
- `data-ai-id`：`workspace-user-groups:surface`（列表容器）、`workspace-user-groups:retry`（错误重试）。

## 文案与校验

- 列名：名称 → `workspace.field.name`；成员 → `workspace.overview.members`；描述 → `common.description`。
- 空态：标题「暂无数据」（`common.empty`）。
- 缺少别名/描述时回落到对象名/ `-`。

## 边界情况

- 组没有绑定：成员数 0，行仍然显示——没有成员是这个组的状态，不代表它不存在。
- 绑定存在但组不在列表（脏数据）：绑定不产生行，页面的行集合以组列表为准。
- 别名与对象名不同：两行都显示，避免在绑定里找不到可复制的对象名。
- 本部署实测：两个企业空间的 groups 与 groupbindings 都是 `totalItems: 0`，因此页面在当前环境显示空态；代码路径由接口契约与单元级别约定保证。

## 明确不做

- 用户组的新建/编辑/删除、成员增删：写路径需要 Group/GroupBinding 的表单与角色绑定联动（老 console 的 EditGroup 弹窗），本轮不做，因此页面没有写按钮。
- 部门树：老 console 的 `/workspaces/:ws/groups` 是树形部门视图（父组 `iam.kubesphere.io/group-parent`）。本页只做平铺列表，层级留给后续。
- 不按「接口不可用」处理本页：`/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/groups` 与 `/workspaces/<ws>/groupbindings` 均返回 200（本部署为空集）。
  作为对照，错误候选路径已探测：`GET /kapis/iam.kubesphere.io/v1alpha2/workspacegroups?limit=-1` → **404**（无此集合）；`GET /kapis/iam.kubesphere.io/v1alpha2/groups` → 200 但返回空集（全局路径需要 label 过滤）。页面因此采用工作空间作用域路径。

## 假设

- GroupBinding 的 `users` 是成员关系的唯一来源；Group 对象本身不含成员列表（CRD 已确认：`GroupBinding{groupRef, users}`）。
- 用户组数量与绑定数量都在 500 以内。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06** — 用户组页按工作空间作用域列出组、成员数与描述。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07** — 成员数由 groupbindings 合并计算，空态/错误态可区分。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04** — 行数与组接口一致；成员数与绑定合并结果一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04`
