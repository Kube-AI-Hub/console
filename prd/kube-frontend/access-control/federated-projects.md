# 联邦项目列表与详情骨架（L3）

[子模块需求](./_index.md)

## 概述

联邦项目是多集群作用域的「项目」：一个 FederatedNamespace 对象同时定义命名空间与它要部署到的集群。老 console 在 `/:workspace/federatedprojects` 有列表与 22 条详情路由；新 UI 此前只有普通项目。2026-11-15 联邦组件开启后本区域进入迁移范围：第一批交付列表（名称/命名空间/集群数/创建时间）与详情概览骨架（基本信息 + 可联邦的命名空间级资源类型只读列表）；第二批在详情上补只读的「已联邦资源」页签组（应用负载 / 配置 / 存储），按项目命名空间列出对应的 Federated 对象；本批让这些资源行可下钻到只读的联邦资源详情（模板 + 分发状态）。写操作仍留到后续。

## 用户故事

### US1 - 查看企业空间里的联邦项目与其部署范围 (Priority: P1)

作为 **企业空间管理员**，我希望 **在企业空间里看到联邦项目列表，并点进任一项目确认它部署在哪些集群、传播是否正常**，以便 **在联邦控制面之外有一个只读的核对入口，而不是只能靠 kubectl**。

**Independent Test**：打开企业空间的联邦项目页，核对列表行数与联邦 API 一致；点进一行，核对基本信息与资源类型列表。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 已知企业空间内存在至少一个 FederatedNamespace，当打开 `/kube-frontend/workspaces/<ws>/federatedprojects`，则列表显示这些项目（名称、命名空间、部署集群、创建时间），行数与该企业空间的 FederatedNamespace 数一致；当点击名称，则进入详情骨架，显示名称、命名空间、企业空间、部署集群、传播状态、创建时间、创建者，以及一份「已联邦资源类型」只读列表（来自联邦 API discovery 的命名空间级 Federated 类型）；已知企业空间没有联邦项目，则列表显示「暂无联邦项目」空态说明；已知对象不存在或读取失败，则详情页分别显示明确的未找到/失败说明，而不是空白页。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03** — 已知联邦项目的资源页签里存在至少一个已联邦对象（或直接访问该对象的详情 URL），当点击资源行名称，则进入该对象的只读详情：显示对象名称、命名空间与类型徽标，「模板」区块以 YAML 展示 `spec.template`，「分发」区块以集群徽标与条件表展示 `status.clusters` / `status.conditions`；已知对象不存在（404），则显示明确的未找到说明；已知对象还没有分发状态，则「分发」区块显示明确说明而不是空表；已知资源类型段未知，则显示未知类型说明。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 已知联邦项目详情可用，当打开它，则页签为「概览 / 应用负载 / 配置 / 存储」且默认在概览（保留基本信息与资源类型列表）；当分别打开「应用负载 / 配置 / 存储」，则每个页签列出该项目命名空间下对应 Federated 类型对象（名称、类型、创建时间），行数等于这些集合的 API 条数之和；已知某页签对应的集合都没有对象，则该页签显示明确的空态说明；已知某集合读取失败，则该页签显示失败说明与重试，不显示空表。

## 设计目标

- 只读 P0：列表与详情都只读，写类 webhook 未稳定前不提供创建/编辑/删除。
- 数据以联邦 API（types.kubefed.io/v1beta1）为准，不依赖 tenant 代理的联邦项目集合（实测该集合返回 0，原因见 design）。
- 详情明确区分「可联邦的类型」与「已联邦的对象」；本轮只展示前者。
- 空态、未找到、读取失败三种结果都给出可读说明。

## 约束与边界

- 作用域：企业空间（`/kube-frontend/workspaces/<ws>/federatedprojects`），不是普通项目作用域。
- 列表按 FederatedNamespace 的 template 标签 `kubesphere.io/workspace` 过滤到当前企业空间。
- 详情只展示命名空间级 Federated 资源类型（discovery 中 namespaced=true），共 13 类；不逐类型列对象（那需要每类一次请求，属于后续）。
- 行内集群来自 `status.clusters`，缺省回退 `spec.placement.clusters`。
- 只读：页面不提供任何写操作。

## UI 交互设计

列表：标题/说明 + 四列表格；名称为链接进入详情；集群列以徽标列出。

详情：返回链接 + 标题 + 页签栏（概览 / 应用负载 / 配置 / 存储）。概览保留「基本信息」定义列表与「已联邦资源类型」只读两列表；其余三个页签各自是一个只读表格（名称、类型、创建时间）或空态/失败说明，名称链接进入联邦资源详情。

联邦资源详情：返回链接 + 名称与类型徽标 + 命名空间；「模板」区块以只读 YAML 展示 `spec.template`；「分发」区块展示 `status.clusters` 徽标与 `status.conditions` 条件表（条件/状态/原因/消息/最近变更）。

- 列表句柄：`federated-projects:surface`；行 `data-ai-row=<名称>`；名称链接 `federated-projects:open:<名称>`。
- 详情句柄：`federated-project:surface`、`:basic`、`:types`、`:types:empty`、`:types:error`、`:not-found`、`:back`；页签面板 `federated-project:tab:{overview|workloads|config|storage}`（触发器 `…:trigger`）；资源表 `federated-project:resources:{workloads|config|storage}`（空态 `…:empty`、失败 `…:error`、重试 `…:retry`）；资源行链接 `federated-project:resource:<segment>/<名称>`。
- 联邦资源详情句柄：`federated-resource:surface`、`:title`、`:kind`、`:template`、`:template:empty`、`:distribution`、`:distribution:empty`、`:not-found`、`:back`、`:retry`。
- 联邦资源详情 URL：`/kube-frontend/workspaces/<ws>/federatedprojects/<项目>/<segment>/<对象>`（segment 取 deployments/services/configmaps 等老 console 段名）。

## 文案与校验

- 列表列：名称、命名空间、部署集群、创建时间；空态：暂无联邦项目 / 该企业空间还没有联邦项目（FederatedNamespace）。
- 详情字段：名称、命名空间、企业空间、部署集群、传播状态（已传播/未就绪）、创建时间、创建者。
- 资源类型提示：来自联邦 API 的命名空间级类型，只读；空态/不可用各一句说明。

## 边界情况

- 企业空间没有联邦项目：列表空态，不显示空表。
- 联邦 API 不可读：列表错误面板 + 重试；详情失败面板 + 重试。
- 名称在路由里但对象已被删除：详情显示「该联邦项目不存在或已被删除」。
- 对象没有 Propagation 条件：传播状态显示 `-`，并给一句「控制面可能尚未处理」的说明。
- `status.clusters` 为空：回退 `spec.placement.clusters`；两者都空时集群列显示 `-`。
- 企业空间别名读取失败：企业空间字段回退为标签里的原始名称。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 企业空间级联邦项目列表：四列、按企业空间过滤、空态明确。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 详情概览：基本信息 + 已联邦资源类型只读列表。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03** — 空态、未找到、读取失败三类结果都有明确说明。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04** — 详情提供 概览 / 应用负载 / 配置 / 存储 四个页签；后三者只读列出项目命名空间下对应 Federated 类型对象（名称/类型/创建时间）。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05** — 每个资源页签独立处理加载、空态与失败+重试。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06** — 资源行名称链接到只读的联邦资源详情（名称/命名空间/类型徽标 + 模板 YAML + 分发状态）。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07** — 联邦资源详情明确区分 未找到（404）、未知类型、无分发状态与读取失败。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 列表行数与联邦 API 的 FederatedNamespace 数一致，首屏 2 秒内就绪。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 从列表到详情一次点击可达，基本信息与对象一致。

## 明确不做

- 不做创建/编辑/删除联邦项目与调整部署集群（写路径待联邦 webhook 稳定）。
- 不做联邦对象的详情页与写操作：本批只读列出资源对象；对象详情、创建/编辑/删除仍是后续。
- 不逐类型列出「已联邦对象」与多集群差异。
- 不做企业空间切换器之外的联邦项目跨空间列表。
- 不做资源页签内的搜索、过滤、分页（对象数量在本环境为 0；数量增长后按普通列表能力补齐）。
- 联邦资源详情不做编辑/删除/事件/日志页签；只读展示模板与分发状态。

## 假设

- FederatedNamespace 的 workspace 归属写在 `spec.template.metadata.labels['kubesphere.io/workspace']`。
- 联邦 API discovery 的 namespaced 资源就是项目内可联邦的资源类型。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03
