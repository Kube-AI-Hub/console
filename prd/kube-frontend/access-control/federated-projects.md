# 联邦项目列表与详情骨架（L3）

[子模块需求](./_index.md)

## 概述

联邦项目是多集群作用域的「项目」：一个 FederatedNamespace 对象同时定义命名空间与它要部署到的集群。老 console 在 `/:workspace/federatedprojects` 有列表与 22 条详情路由；新 UI 此前只有普通项目。2026-11-15 联邦组件开启后本区域进入迁移范围，本轮先交付 P0：列表（名称/命名空间/集群数/创建时间）与详情概览骨架（基本信息 + 可联邦的命名空间级资源类型只读列表），写操作留到后续。

## 用户故事

### US1 - 查看企业空间里的联邦项目与其部署范围 (Priority: P1)

作为 **企业空间管理员**，我希望 **在企业空间里看到联邦项目列表，并点进任一项目确认它部署在哪些集群、传播是否正常**，以便 **在联邦控制面之外有一个只读的核对入口，而不是只能靠 kubectl**。

**Independent Test**：打开企业空间的联邦项目页，核对列表行数与联邦 API 一致；点进一行，核对基本信息与资源类型列表。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 已知企业空间内存在至少一个 FederatedNamespace，当打开 `/kube-frontend/workspaces/<ws>/federatedprojects`，则列表显示这些项目（名称、命名空间、部署集群、创建时间），行数与该企业空间的 FederatedNamespace 数一致；当点击名称，则进入详情骨架，显示名称、命名空间、企业空间、部署集群、传播状态、创建时间、创建者，以及一份「已联邦资源类型」只读列表（来自联邦 API discovery 的命名空间级 Federated 类型）；已知企业空间没有联邦项目，则列表显示「暂无联邦项目」空态说明；已知对象不存在或读取失败，则详情页分别显示明确的未找到/失败说明，而不是空白页。

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

详情：返回链接 + 标题 + 「基本信息」定义列表 + 「已联邦资源类型」只读两列表（类型/资源名）。

- 列表句柄：`federated-projects:surface`；行 `data-ai-row=<名称>`；名称链接 `federated-projects:open:<名称>`。
- 详情句柄：`federated-project:surface`、`:basic`、`:types`、`:types:empty`、`:types:error`、`:not-found`、`:back`。

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

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01** — 列表行数与联邦 API 的 FederatedNamespace 数一致，首屏 2 秒内就绪。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02** — 从列表到详情一次点击可达，基本信息与对象一致。

## 明确不做

- 不做创建/编辑/删除联邦项目与调整部署集群（写路径待联邦 webhook 稳定）。
- 不做联邦项目内的资源页（应用负载/配置/存储等 22 条老路由），详情本轮只到概览骨架。
- 不逐类型列出「已联邦对象」与多集群差异。
- 不做企业空间切换器之外的联邦项目跨空间列表。

## 假设

- FederatedNamespace 的 workspace 归属写在 `spec.template.metadata.labels['kubesphere.io/workspace']`。
- 联邦 API discovery 的 namespaced 资源就是项目内可联邦的资源类型。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01
