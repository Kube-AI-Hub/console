# 集群列表（L3）

[子模块需求](./_index.md)

## 概述

平台级入口页：列出平台已知的集群，以及判断「能不能用」的两件事——是否就绪、跑的是什么版本；另有节点数与创建时间。名称链接进入该集群的控制台概览。

路径是 `/kube-frontend/clusters`（没有集群段）。老 console 的「平台管理 → 集群」指向同一个位置。

## 用户故事

### US1 - 找到要进的集群 (Priority: P1)

作为 **平台管理员**，我希望 **在一个列表里看到所有集群**，以便 **直接点进要操作的那个，而不是先猜集群名拼地址**。

**Independent Test**：打开集群列表，核对行数与接口返回的集群对象数一致，且每行名称是指向 `/kube-frontend/clusters/<name>/overview` 的链接。

### US2 - 看出哪个集群不健康 (Priority: P1)

作为 **平台管理员**，我希望能 **直接看到就绪状态与不健康的原因**，以便 **不必进入每个集群才能发现某个集群掉线**。

**Independent Test**：核对就绪徽标与集群对象 `Ready` 条件一致；未就绪时同一行显示条件消息。

### US3 - 刚接入的集群不用整页刷新 (Priority: P2)

作为 **平台管理员**，我希望 **点一下就能重新拉取集群列表**，以便 **在成员集群刚连上时不重载整个控制台就能看到它变成就绪**。

**Independent Test**：点工具栏刷新，核对列表重新拉取了集群集合并回到就绪态。

### US4 - 移除一个不再管理的集群 (Priority: P1)

作为 **平台管理员**，我希望 **把成员集群从平台移除**，以便 **不再管理的集群不会继续出现在项目与工作负载视图里**。

**Independent Test**：接入一个临时集群，从行操作移除并回读对象，确认 404；成员集群本身不被改动。

### US5 - 换掉成员集群的 kubeconfig (Priority: P2)

作为 **平台管理员**，我希望 **在成员集群换了访问凭据后更新 kubeconfig**，以便 **不必删除再重新接入**。

**Independent Test**：对一个直接连接的临时集群点「更新 kubeconfig」，提交非法内容时界面给出服务端原因且对象未被改动。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01** — 已知平台注册了若干集群，当打开 `/kube-frontend/clusters`，则列出全部集群；每行显示名称（别名优先、副行为对象名或供应者；有环境标签时一并显示）、状态徽标、**角色**（主集群/成员集群）、Kubernetes 版本、节点数与创建时间；主集群排在最前；行数等于 `clusters` 接口返回数；名称链接指向该集群的概览页；未就绪的集群显示条件消息。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-02** — 已知列表处于就绪态，当点击工具栏的刷新，则重新拉取 `clusters` 接口且列表回到就绪态（用于集群刚接入、刚从代理连上等场景，避免只能整页刷新）。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-03** — 已知列表里有一个非主集群，当通过行操作「移除集群」并输入集群名确认，则该 `Cluster` 对象被删除（回读 404），列表不再包含它；主集群行没有「移除集群」；未输入正确名称时确认按钮不可用。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-04** — 已知列表里有一个非主集群且连接方式为直接连接，当通过行操作「更新 kubeconfig」提交一段不可用的 kubeconfig，则界面显示服务端给出的原因（而不是「Bad Request」之类通用文案），且集群对象的 `spec.connection.kubeconfig` 未被改动；代理连接的集群不提供该操作。

## 设计目标

1. 一屏回答「有哪几个集群、哪个不能用」。
2. 名称即入口：看到集群名的下一个动作是进去。
3. 就绪状态必须带原因，否则「未就绪」无法行动。

## 约束与边界

- 读 `/kapis/cluster.kubesphere.io/v1alpha1/clusters`（与集群概览同一路径，避免两页不一致）。
- 只读；集群注册/删除不在本页。
- 平台级路径：没有 workspace、cluster、namespace 段。

## UI 交互设计

- 列：名称（链接 + 供应者副行）、状态（徽标 + 条件消息）、Kubernetes 版本、节点数、创建时间；窄屏依次折叠。
- 搜索匹配集群名与供应者。

## 文案与校验

- 状态：运行正常 / 未就绪 / 已停用。
- 空态：暂无集群 + 说明。

## 边界情况

- `spec.enable: false`：显示「已停用」，优先于就绪状态。
- Ready 条件缺失：按未就绪处理。
- 只有一个集群：仍然渲染表格（不是空态）。

## 明确不做

- 集群注册 / 注销 / 上下线（需要平台侧注册接口与 kubeconfig 校验）。
- 跨集群的聚合指标（需要按集群分别取指标，属集群监控）。
- 集群卡片视图：列表固定 10 条/页且为表格形态，卡片在同等信息量下占屏更大。host 与成员集群的区分用「角色」列与筛选完成，不单独分区展示（老 console 的分组卡片视图不迁移）。

## 假设

- 平台返回标准 `{items}` 信封；每个对象都有 `metadata.name`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01** — 读集群列表接口，按对象映射为行。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-02** — 名称链接到该集群的概览页。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01** — 行数与接口一致；就绪状态与 Ready 条件一致；链接可达。
