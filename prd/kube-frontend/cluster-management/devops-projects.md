# DevOps 工程（L3）

[子模块需求](./_index.md)

## 概述

集群控制台的 **DevOps 工程** 区域：列表页 `/kube-frontend/clusters/<cluster>/devops`（名称 / 描述 / 创建时间 / 所属企业空间）与详情骨架 `/kube-frontend/clusters/<cluster>/devops/<name>`（基本信息 + 成员 / 角色 / 凭证页签）。只读。

DevOps 组件在 2026-11-15 随「所有组件已开启」进入迁移范围；本集群 `devopsprojects` 当前为 0 个，因此空态是主路径，详情页以「骨架 + 诚实的失败/空态」交付，不伪造数据。

## 用户故事

### US1 - 集群管理员进入 DevOps 工程 (Priority: P1)

作为 **集群管理员**，我希望 **在集群控制台里看到全部 DevOps 工程并能打开其中一个**，以便 **不切换旧控制台就能确认工程是否存在、归属哪个企业空间、有哪些成员/角色/凭证**。

**Independent Test**：打开 `/clusters/<cluster>/devops`，核对行数与 `devopsprojects` CRD 列表一致（当前为 0 时显示空态）；打开任一工程（或一个不存在的工程名），核对基本信息区与三个页签可切换，且每个页签显示表格、空态或失败原因之一。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 已知集群的 `devopsprojects` 列表有 N 个工程（N 可能为 0），当打开集群 DevOps 列表，则列出 N 行（名称/描述/所属企业空间/创建时间），名称为进入详情的链接；N 为 0 时显示明确空态。打开详情 `/devops/<name>` 时，显示基本信息（名称/企业空间/创建者/创建时间/描述）；成员 / 角色 / 凭证三个页签可切换，各自独立读取：能读则显示表格，集合为空显示空态，读取失败显示失败原因与重试（不显示空表冒充「没有」）；工程不存在时显示 `:not-found`。列表与详情均只读。

## 设计目标

1. 让 DevOps 区域在集群菜单里可达，空集群也给出可信的空态而不是空白页。
2. 详情页的每个集合独立成败：一个接口失败不拖垮其他页签。
3. 不伪造：没有工程就没有行；读不到就显示原因与重试。

## 约束与边界

- 列表与基本信息读 **cluster-scoped CRD**：`/apis/devops.kubesphere.io/v1alpha3/devopsprojects`（列表）、`/apis/…/devopsprojects/<name>`（详情）。实测 kapis `/kapis/devops.kubesphere.io/v1alpha3/devopsprojects` 返回 404。
- 成员：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members?limit=-1`（实测路由存在，工程不存在时返回 404 `devopsproject… not found`）。
- 角色：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/roles?limit=-1`（同上）。
- 凭证：`/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials?limit=-1`（同上）。
- 只读：创建/编辑工程、流水线编辑器不在本轮。
- 作用域：本区域在 registry 里是 cluster scope，URL 不带 workspace；旧 console 的 `/:workspace/clusters/:cluster/devops` 依赖 workspace 段，新 UI 的集群菜单无法表达它（见 design DEC）。

## UI 交互设计

- 列表：标题+描述；表格列 名称（链接）/ 描述 / 所属企业空间 / 创建时间；空态「暂无 DevOps 工程」。
- 详情：返回链接 + 标题；基本信息卡；页签 成员 / 角色 / 凭证。
- 每个页签：加载骨架；表格；空态说明；失败时为错误文案 + 重试按钮。
- `data-ai-id`：列表 `devops:surface`、`devops:link:<name>`、`devops:retry`；详情 `devops-detail:surface`、`:title`、`:basic`、`:name`、`:workspace`、`:creator`、`:description`、`:created-at`、`:tab:members|roles|credentials`、`:members|roles|credentials`（面板）、`:…-table`、`:…-empty`、`:…-error`、`:…-retry`、`:not-found`、`:back`。

## 文案与校验

- 区域/标题：`devops.title`、`devops.list.title`、`devops.list.description`；空态 `devops.list.emptyTitle/emptyDescription`。
- 页签：`devops.detail.members/roles/credentials`；空态 `devops.detail.membersEmpty/rolesEmpty/credentialsEmpty`。
- 字段复用：`cluster.column.name/createdAt`、`projectInfo.field.description/workspace`、`workspace.detail.basic/creator`、`workspace.field.member/role`、`platform.column.ruleCount`、`cluster.customResources.kind`、`common.retry`、`error.notFound`。

## 边界情况

- `devopsprojects` 为 0（当前 B200）：列表空态；详情仅当手动输入名称时可达，显示 not-found，但页签仍可切换并各自展示失败原因（便于验证骨架）。
- 工程存在但成员/角色/凭证为空：对应页签显示空态。
- 某个集合 403/404：该页签显示失败原因 + 重试，其他页签不受影响。
- 工程刚被删除：基本信息 404 → `:not-found`；页签各自失败，不伪造空表。
- 基本信息读取失败但不是 404：错误面板 + 重试。

## 明确不做

- 创建/编辑/删除 DevOps 工程：需 ks-devops 写接口与 webhook（当前环境写类 webhook 不稳定）。
- 流水线 / 持续部署 / 代码仓库页签：需要 ks-devops 专属 API 与编辑器，后续任务。
- 成员增删与角色/凭证编辑：写路径不在本轮。
- 工程用量与流水线统计。

## 假设

- `devops.kubesphere.io/v1alpha3` 的 `devopsprojects` CRD 已注册且可读（实测 200，items=[]）。
- 成员/角色/凭证的 kapis 路径已注册（实测对不存在工程返回资源 not-found，说明路由存在）。
- 工程对象用 `kubesphere.io/workspace` 标签归属企业空间，用 `kubesphere.io/description`/`creator` 注解存元数据。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 集群 DevOps 列表展示工程并提供详情入口，空态明确。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02** — 详情提供基本信息与成员/角色/凭证页签，各集合独立显示表格/空态/失败原因。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01** — 列表行数与 `devopsprojects` 一致；详情页签可切换且三种状态可辨；不伪造数据。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01`
