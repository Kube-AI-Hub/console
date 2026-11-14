# 集群作用域项目详情（L3）

[子模块需求](./_index.md)

## 概述

集群控制台的「项目」列表（`/kube-frontend/clusters/<cluster>/namespaces`）此前每行没有落点：项目名是纯文本，想了解一个项目的基本信息、配额与限额只能切到项目控制台或平台侧页面。本页补上**只读的项目详情**：

- **基本信息**：名称、状态、创建时间、标签（含所属企业空间标签）；
- **配额用量**：该项目 ResourceQuota 的 used/hard，逐资源一行；
- **限额范围摘要**：LimitRange 注入的默认 request/limit；
- **跳转**：进入项目作用域的概览 / 容器组 / 配置字典（存在企业空间标签时）。

URL：`/kube-frontend/clusters/<cluster>/namespaces/<name>`。列表行名称链接进入本页（`projects:link:<name>`）。

## 用户故事

### US1 - 集群管理员从项目列表下钻一个项目 (Priority: P1)

作为 **集群管理员**，我希望 **在集群的项目列表里点开一个项目，看到它的状态、标签、配额与限额**，以便 **不切换控制台就能判断这个项目是否异常、配额是否接近上限**。

**Independent Test**：从集群项目列表点击一个项目名进入详情，核对名称/状态/创建时间/标签与命名空间对象一致；配额区块显示空态或 used/hard 表；限额区块显示空态或默认 request/limit 表；点返回回到列表。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01** — 已知集群存在项目 `<name>`（命名空间对象可读），当从集群项目列表点击该项目名，则打开项目详情页并显示基本信息（名称/状态/创建时间/标签）；配额区块按 ResourceQuota 的 used/hard 逐资源显示，无配额时显示明确空态；限额范围区块显示 LimitRange 的默认 request/limit，无 LimitRange 时显示明确空态；读取命名空间失败时显示错误面板 + 重试；**项目不存在时显示 `namespace-detail:not-found` 说明**（resources 代理对缺失命名空间返回 500 且消息为 `namespace "<name>" not found`，不能当普通错误重试）；页面只读。

## 设计目标

1. 一个下钻页回答「这个项目现在什么样、用量多少」，不复制平台侧写入口。
2. 三个读数（命名空间、配额、LimitRange）各自独立，限额读取失败只降级该区块。
3. 缺失项目与失败可区分：前者给「资源不存在」，后者给重试。

## 约束与边界

- 命名空间对象与配额：`projectInfoApi.get({cluster, namespace})`（resources 代理 `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<name>` + 核心组 ResourceQuota）。
- LimitRange：`limitRangesApi.list({namespace})`（`/api/v1/namespaces/<name>/limitranges`）。
- 只读：编辑配额/限额属于项目设置页，且当前集群写类 webhook 故障，本页不提供写入口。
- 跨集群：URL 带 cluster；B200 只有 host 一个集群，读取走同一 ks-apiserver。

## UI 交互设计

- 顶部：返回「项目」链接；标题为项目名；副标题说明。
- 基本信息卡：名称 / 创建时间 + 状态徽标 + 标签 chips。
- 配额卡：表格 资源 / 上限 / 已用；无配额显示说明。
- 限额范围卡：表格 类型 / 资源 / 请求 / 限制（默认 request/limit）；无 LimitRange 或读取失败分别说明。
- 跳转卡：概览 / 容器组 / 配置字典（项目作用域），仅当标签带 `kubesphere.io/workspace` 且值非空。
- `data-ai-id`：`namespace-detail:surface`、`:title`、`:name`、`:status`、`:labels`、`:created-at`、`:quota`、`:quota-table`、`:quota-empty`、`:limits`、`:limits-table`、`:limits-empty`、`:limits-unavailable`、`:links`、`:back`、`:retry`、`:not-found`；列表入口 `projects:link:<name>`。

## 文案与校验

- 标题/描述复用 `cluster.projects.title` 与 `project.overview.description`。
- 字段：`cluster.column.name/status/createdAt`、`metadata.labels`、`workspace.detail.basic`。
- 配额：`project.overview.quota`、`projectInfo.quota.resource/hard/used/empty`。
- 限额：`project.overview.limitRanges/noLimitRanges/limitRangesUnavailable`、`container.field.requests/limits`、`cluster.customResources.kind`、`projectInfo.quota.resource`。
- 缺失项目：`error.notFound`。

## 边界情况

- 项目不存在：resources 代理返回 **500** + `namespace "<name>" not found`；页面按消息识别为 not-found，显示 `:not-found`，不提供无意义的重试循环。
- 没有 ResourceQuota（B200 全部项目如此）：配额卡显示「该项目没有设置资源配额。」
- 没有 LimitRange：限额卡显示「该项目没有限额范围。」
- LimitRange 读取失败：只该卡显示「限额范围不可用」，基本信息与配额仍在。
- 标签很多/值很长：chips 自动换行；不截断键值。
- 企业空间标签缺失：不渲染跳转卡（构建项目 URL 需要 workspace 段）。

## 明确不做

- 编辑配额 / LimitRange / 标签 / 状态：写路径在项目设置，且当前 webhook 故障。
- 项目成员、角色、服务账号列表：项目设置页已有。
- 用量趋势/监控图表：概览页与监控页已有，本页只显示 ResourceQuota 快照。
- 删除项目。

## 假设

- 集群级「项目」即命名空间；`kubesphere.io/workspace` 标签标识所属企业空间。
- ResourceQuota 与 LimitRange 都可用核心 API 读取（实测 200，B200 配额/限额集合均为空）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01** — 集群项目列表行链接到项目详情，并展示基本信息/配额/限额。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-02** — 无配额/无限额/缺失项目/读取失败四种状态各自可辨，页面只读。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01** — 基本信息与命名空间对象一致；配额行数 = hard 键数；限额行数 = LimitRange 条目展开数；not-found 句柄可命中。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01`
