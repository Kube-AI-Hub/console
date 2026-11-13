# 企业空间详情（L3）

[子模块需求](./_index.md)

## 概述

一个企业空间的详情：它是什么（名称、别名、描述、管理员、创建者、创建时间、部署集群），以及**它下面有哪些项目**。项目逐条链接到自己的控制台。

企业空间是租户边界：项目归属由命名空间上的 `kubesphere.io/workspace` 标签决定，部署集群来自 `spec.placement.clusters`。

## 用户故事

### US1 - 看清一个企业空间里有什么 (Priority: P1)

作为 **平台管理员**，我希望 **从一个企业空间直接看到它的项目列表**，以便 **不必逐个去猜项目属于哪个企业空间**。

**Independent Test**：打开企业空间详情，核对项目数与带该企业空间标签的命名空间数一致；点项目名进入其控制台。

### US2 - 看清这个企业空间里谁能进 (Priority: P1)

作为 **平台管理员**，我希望 **在企业空间详情看到成员与他们的企业空间角色**，以便 **在交接或审计时知道谁能进入这个租户**。

**Independent Test**：打开企业空间详情，核对成员条数等于 workspacemembers 接口返回数，角色列等于 `iam.kubesphere.io/workspacerole` 注解。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01** — 已知平台上有企业空间，当从列表点名称进入详情，则显示名称、别名、管理员、创建者、创建时间、部署集群与描述；项目区块列出该企业空间下的全部项目（数量等于带 `kubesphere.io/workspace=<名称>` 标签的命名空间数），每项显示状态与创建时间，点名称进入该项目控制台；没有项目时显示空态说明。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02** — 已知企业空间有成员，当打开企业空间详情，则「成员」区块逐条列出用户名、企业空间角色与状态，条数等于 `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<名称>/workspacemembers` 返回条数；没有成员或接口不可用时显示说明而非空表。

## 设计目标

1. 一屏回答「这个企业空间里有什么」。
2. 项目名是入口，不是文本。

## 约束与边界

- 读 `/kapis/tenant.kubesphere.io/v1alpha2/workspaces/<name>`（与列表同一存储）。
- 项目读 `/kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=<name>`。
- 只读。

## UI 交互设计

- 顶部返回链接 + 名称（别名优先）。
- 基本信息两列；描述单独一行。
- 项目区块：标题带数量，列表项为「名称（链接）+ 状态徽标 + 创建时间」。

## 文案与校验

- 无项目：该企业空间下还没有项目。
- 空值统一 `-`。

## 边界情况

- 企业空间未部署在任何集群（`placement.clusters` 为空）：部署集群显示 `-`，项目链接回落到 host。
- 项目列表读取失败：只有该区块显示错误与重试，不影响基本信息。

## 明确不做

- 企业空间成员与角色：其 API 属于另一个聚合（且 `/workspaces/<name>/members` 在本集群返回 404），未迁移前不显示空表——空表会被读成「没有任何人有权限」。
- 企业空间编辑/删除：需要写接口与配额联动，另立功能点。

## 假设

- 项目归属只认命名空间上的 `kubesphere.io/workspace` 标签。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01** — 读企业空间对象展示基本信息。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02** — 按标签列项目并链接到项目控制台。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01** — 项目数等于带标签的命名空间数；管理员/创建者与对象一致。
