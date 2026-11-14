# DevOps 工程 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/devops-projects.md)

## 概述

集群作用域的 DevOps 区域：`/kube-frontend/clusters/<cluster>/devops`（列表）与 `…/devops/<name>`（详情：基本信息 + 成员/角色/凭证/流水线/持续部署/代码仓库六个页签）。数据来自 devops CRD、devops/iam kapis 集合、devops 组的 pipelineruns/gitrepositories 以及 gitops 组的 applications，全部只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02

## 设计目标与非目标

目标：区域可达、空态可信、详情每个集合独立成败且不伪造；流水线/CD/代码仓库三个只读页签用工程命名空间读取。
非目标：创建/编辑工程、流水线编辑器与运行、CD 同步/回滚、代码仓库写操作、成员/角色/凭证写操作。

## 关键约束

- 列表与基本信息：`/apis/devops.kubesphere.io/v1alpha3/devopsprojects[/<name>]`（实测 200 / 404 NotFound）。kapis `/kapis/devops.kubesphere.io/v1alpha3/devopsprojects` 为 **404**。
- 成员：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members?limit=-1`。
- 角色：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/roles?limit=-1`。
- 凭证：`/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials?limit=-1`。
- 上述三条 kapis 在工程不存在时返回 404 资源 not-found（说明路由存在）；写类接口不做，当前环境 webhook 不稳。
- 流水线：`/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelines`（实测 200，items=[]）。
- 代码仓库：`…/gitrepositories`（实测 200）；`…/coderepositories` 为 **404**，老 console 的 codeRepos 模块读的就是 gitrepositories。
- 持续部署：`/apis/gitops.kubesphere.io/v1alpha1/namespaces/<ns>/applications`（实测 200）；devops 组的 `…/cd`、`…/applications` 与 kapis 同名路径均为 **404**。
- 命名空间：DevOpsProject CRD 的 `status.adminNamespace`（schema 已核实，是唯一 status 字段）；当前 0 个对象，无实例可核对，缺失时回退工程名。
- 区域在 registry 中为 cluster scope，URL 无 workspace 段。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01 — 列表/基本信息读 cluster-scoped CRD，而不是 kapis 聚合

**为什么**：registry 把 DevOps 区域登记为 cluster scope（集群菜单，URL 无 workspace），而老 console 的 kapis 读取形状（`/kapis/devops.../workspaces/<ws>/devops`、`/kapis/tenant.../workspaces/<ws>/devops`）都需要 workspace 段；本页没有该参数。`devopsprojects` 本身是 cluster-scoped CRD，一次列出全部工程，并带 `kubesphere.io/workspace` 标签用于展示归属。
**被否方案**：把 URL 改成 `/:workspace/clusters/:cluster/devops`。集群菜单的链接由 registry scope 生成（`/kube-frontend/clusters/<id>/devops`），workspace-prefixed 路由在集群菜单里不可达。
**何时重新考虑**：产品决定 DevOps 必须按企业空间过滤/授权时，把区域改成 workspace scope 并改 URL（需同步 registry 与 shell）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02 — 详情页签以工程名为键，分别读取 IAM/devops 的工程级集合

**为什么**：成员/角色在 IAM 聚合下 `/devops/<name>/...`，凭证在 devops 组 `/devops/<name>/credentials`；三者都以工程名解析，不需要 workspace 段，和 cluster-scope 详情 URL 自洽。每个查询独立，失败只影响本页签。
**被否方案**：一个 Promise.all 拿全部页签。任一集合 403/404 会让基本信息之外的页面全部不可用，且违背「不伪造」时无法区分空与读不到。
**何时重新考虑**：ks-devops 提供一次性工程详情聚合接口时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03 — 工程不存在时仍渲染页签

**为什么**：当前集群 `devopsprojects` 为 0，详情页只能通过手输名称到达。若 not-found 时隐藏页签，「页签可切换」将无法验收，读者也无法判断是「没有工程」还是「页面缺块」。保留页签并让每个页签显示失败原因+重试，既诚实又可观测。
**被否方案**：404 时整页只有 not-found。骨架的价值在于证明每个集合的真实读取结果。
**何时重新考虑**：有真实工程且产品要求 404 即返回列表时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04 — 工程命名空间取 `status.adminNamespace`，缺失时回退工程名

**为什么**：流水线、CD、代码仓库都是 namespaced 资源，命名空间由 devops 控制器写进 DevOpsProject 的 `status.adminNamespace`（CRD 唯一的 status 字段，schema 已核实）。不能假设它等于工程名：工程名只是 CRD 的 `metadata.name`，命名空间由控制器创建。回退到工程名只在对象缺失或控制器尚未写入时使用，且基本信息会把实际命名空间显示出来，让回退值可诊断而不是隐形。
**被否方案**：直接用工程名当命名空间（老 console 的做法）。在控制器为命名空间加前缀或改名时会全部读错，且没有任何提示。
**被否方案**：等 `status.adminNamespace` 存在才发请求。当前集群 0 个工程，详情页将无法验证页签，也会让半创建工程显示空白而非空态。
**何时重新考虑**：ks-devops 提供显式的工程→命名空间解析接口，或 CRD 改字段时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05 — 三个页签各发各的请求，沿用「独立成败」原则

**为什么**：三类资源在三个组（devops pipelines / devops gitrepositories / gitops applications），任何一类未安装或 403 都不应影响另外两类。每个页签一个 `useQuery`，与成员/角色/凭证页签同一模式（见上一条方案决策）；代码集中到 api-client 的 `devops.ts`，页面只负责表格与三态。
**被否方案**：一个聚合并行请求。会让「哪一个集合失败」从页签状态退化为整页错误。
**何时重新考虑**：出现一次返回工程全部集合的聚合接口时。

## 系统现状

老 console：`/:workspace/clusters/:cluster/devops` 列表（tenant API），详情 `…/devops/:devops` 下流水线/CD/代码仓库/基本信息/成员/角色/凭证七个页签，写操作齐备。新 UI 先交付列表与详情骨架（三个属性页签），本轮补齐流水线 / 持续部署 / 代码仓库三个只读页签；写操作另立。

## 仓库落点

- 列表页：`apps/console-next/src/pages/devops/DevopsProjectsPage.tsx`
- 详情页：`apps/console-next/src/pages/devops/DevopsProjectDetailPage.tsx`（六个页签）
- api-client：`packages/api-client/src/devops.ts`（三类集合读取、命名空间派生、状态映射）
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/devops/{route,index}.tsx` 与 `$name.tsx`
- registry：`areas/registry.ts` 的 devops 区域页 status 改为 ready（随集成提交）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 工程列表 | `/apis/devops.kubesphere.io/v1alpha3/devopsprojects` | `metadata.name/creationTimestamp/labels/annotations` |
| 工程详情 | `/apis/devops.kubesphere.io/v1alpha3/devopsprojects/<name>` | 同上；404 为 NotFound Status |
| 成员 | `/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members?limit=-1` | `items[].metadata.name/annotations` |
| 角色 | `/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/roles?limit=-1` | `items[].metadata.name/annotations`、`rules[]` |
| 凭证 | `/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials?limit=-1` | `items[].metadata.name/creationTimestamp`、`type` |
| 流水线 | `/apis/devops.kubesphere.io/v1alpha3/namespaces/<adminNamespace>/pipelines` | `metadata.name/creationTimestamp/annotations`、`spec.type` |
| 代码仓库 | `/apis/devops.kubesphere.io/v1alpha3/namespaces/<adminNamespace>/gitrepositories` | `metadata.name/creationTimestamp`、`spec.provider/url` |
| 持续部署 | `/apis/gitops.kubesphere.io/v1alpha1/namespaces/<adminNamespace>/applications` | `metadata.name`、`spec.argoApp.spec.destination.namespace`、`status.argoApp`（JSON 字符串） |

## 不变量

1. 列表行数 = CRD items 数；0 时显示空态。
2. 详情基本信息与 CRD 对象一致；404 显示 `:not-found`。
3. 每个页签独立：表格 / 空态 / 失败原因+重试三选一，读不到不得显示空表。
4. 页面不发出任何写请求。
5. 流水线/持续部署/代码仓库的命名空间 = `status.adminNamespace`，缺失时回退工程名；基本信息 `:namespace` 显示的就是三个查询实际用的值。
6. 持续部署的同步/健康状态只从 `status.argoApp` 派生；解析不出时显示 `-`，不猜状态。

## 已知坑

- **kapis 的 devopsprojects 是 404**：列表必须走 `apis/`；把 `/kapis/devops.../v1alpha3/devopsprojects` 当列表会得到 Page Not Found。
- **工程不存在时错误消息不带 kind 前缀**（IAM 路径返回 `devopsproject.devops.kubesphere.io "x" not found`，devops 路径返回复数），不要按字符串前缀判类型，只按 not-found 状态与消息判断。
- **`rules` 可能缺失**：角色页签的规则数按 `rules?.length ?? 0` 展示。
- **凭证的 type 位置不固定**：优先对象顶层 `type`，其次 `kind`；都没有显示 `-`。
- **空集群主路径**：B200 当前 0 个工程，列表空态与详情 not-found 是必测路径。
- **写操作不可用**：当前 webhook 不稳，本页不提供任何写入口。
- **`coderepositories` 是 404**：代码仓库的真实资源是 `gitrepositories`（GitRepository）；老 console 的 `codeRepos` 模块同样读它。
- **devops 组没有 `cd`**：`…/cd` 与 `…/applications` 均 404；持续部署读 gitops 组的 `applications`（`apiVersion: gitops.kubesphere.io/v1alpha1`），对象用 `spec.argoApp` / `status.argoApp` 包着 Argo CD 的结构。
- **`status.argoApp` 是字符串**：CRD 把 Argo 状态声明为 string，控制器写 JSON。按 JSON 解析取 `sync.status`/`health.status`，解析失败时把原字符串当同步状态，避免整列空白。
- **不存在的命名空间返回 200 空列表**：三个列表接口对不存在的命名空间不报错（已实测 `tc-e2e-missing-devops-probe`），所以不存在工程时页签显示空态而非错误；这也是本轮验证三个页签的路径。
- **工程命名空间无实例可核对**：B200 当前 0 个工程，`status.adminNamespace` 只从 CRD schema 确认存在；用 `devopsProjectNamespace` 的单元测试固定「有值用值、无值回退工程名」。

## 测试与可观测

用例：
- `tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01.yaml`（列表 + 三个属性页签）
- `tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02.yaml`（三个流水线类页签：空态、失败+重试、命名空间取值）
- 单元：`packages/api-client/test/devops.test.ts`（命名空间派生、三类映射、路径）。

可观测点：列表 `devops:surface`、`devops:link:<name>`；详情 `devops-detail:surface/title/basic/namespace/not-found/tab:*` 与各页签的 `-table/-empty/-error/-retry` 句柄。

## 后续改进

- 流水线编辑器与运行、CD 同步/回滚、代码仓库创建/编辑（需要 ks-devops/gitops 写接口，webhook 恢复后再做）。
- 流水线运行记录页签与 CD 明细页。
- 工程的创建/删除与成员/角色/凭证写操作。
- 若 DevOps 改为按企业空间授权，按 DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01 的「何时重新考虑」调整为 workspace scope。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02
