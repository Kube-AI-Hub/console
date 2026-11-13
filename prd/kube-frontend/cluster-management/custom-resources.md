# 自定义资源（L3）

[子模块需求](./_index.md)

## 概述

本集群可提供的**自定义资源定义（CRD）**列表：类型（副行为所属组与版本）、全名、作用域、是否已提供、创建时间。

数据读 `apiextensions.k8s.io/v1` 的 `customresourcedefinitions`，不走 resources 代理——「这个集群能提供什么」这个问题，回答过时就没有意义。

## 用户故事

### US1 - 确认某个 CRD 是否已注册 (Priority: P1)

作为 **集群管理员或开发**，我希望 **按类型或全名搜到某个 CRD**，以便 **在写 manifest 之前确认这个资源可用，而不是提交后才被拒**。

**Independent Test**：搜索一个已知 kind，核对首行就是它，且副行显示 `组/版本`。

### US2 - 区分集群级与命名空间级 (Priority: P1)

作为 **开发**，我希望 **看到每个 CRD 的作用域**，以便 **知道 manifest 里要不要写 `metadata.namespace`**。

**Independent Test**：核对每一行的作用域只可能是「集群级」或「命名空间级」，且与接口 `spec.scope` 一致。

### US3 - 看出哪些 CRD 已停用 (Priority: P2)

作为 **集群管理员**，我希望 **看到 CRD 是否仍被提供**，以便 **解释「资源已注册但创建被拒」的现象**。

**Independent Test**：核对「已提供」徽标与接口 `spec.versions[].served` 一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01** — 已知集群注册了若干 CRD，当打开自定义资源页，则列出全部 CRD；每行显示类型、`组/存储版本`、全名、作用域（集群级/命名空间级）、是否已提供与创建时间；行数与 `customresourcedefinitions` 接口返回一致；按类型排序时首列为类型。

## 设计目标

1. 一屏回答「能写什么资源」。
2. 作用域与是否提供是两列独立事实，不合并成一个徽标。
3. 排序与搜索在已取回的集合上做（CRD 数量有限）。

## 约束与边界

- 读 `/apis/apiextensions.k8s.io/v1/customresourcedefinitions`（`limit=-1`）。
- 只读。
- 不提供详情页：老 console 的 CRD 详情列出该类型的实例，需要按 group/version/plural 动态拼接路径，另立功能点。

## UI 交互设计

- 列：类型（副行 `组/版本`）、名称、作用域、已提供、创建时间；窄屏依次折叠。
- 搜索同时匹配 kind 与全名：前者是写 manifest 时用的词，后者是排错时看到的词。
- 已提供用徽标，未提供用弱化徽标。

## 文案与校验

- 作用域：集群级 / 命名空间级。
- 已提供 / 未提供。
- 空态：暂无自定义资源 + 一句原因。

## 边界情况

- CRD 没有任何已提供版本（全部 `served: false`）：显示「未提供」，但仍列在表中。
- 存储版本缺失：副行只显示组名，不显示斜杠。
- 接口失败：错误面板 + 重试。

## 明确不做

- CRD 详情与实例列表（动态路径拼接，另立功能点）。
- CRD 创建/编辑/删除（属安装器职责）。
- 按组分组展示（当前规模不需要）。

## 假设

- 返回标准 `{items}` 信封，`spec.versions` 至少有一项。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01** — 读 apiextensions 组，一次取全量。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02** — 存储版本排在版本列表首位用于展示。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-03** — 搜索匹配 kind 与全名；排序在本地完成。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01** — 行数与接口一致；作用域与 served 与接口一致；搜索 kind 得到对应行。
