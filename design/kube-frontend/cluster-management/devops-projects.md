# DevOps 工程 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/devops-projects.md)

## 概述

集群作用域的 DevOps 区域：`/kube-frontend/clusters/<cluster>/devops`（列表）与 `…/devops/<name>`（详情骨架：基本信息 + 成员/角色/凭证页签）。数据来自 devops CRD 与 devops/iam kapis 集合，全部只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01

## 设计目标与非目标

目标：区域可达、空态可信、详情骨架的每个集合独立成败且不伪造。
非目标：创建/编辑工程、流水线/CD/代码仓库页签、成员/角色/凭证写操作。

## 关键约束

- 列表与基本信息：`/apis/devops.kubesphere.io/v1alpha3/devopsprojects[/<name>]`（实测 200 / 404 NotFound）。kapis `/kapis/devops.kubesphere.io/v1alpha3/devopsprojects` 为 **404**。
- 成员：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members?limit=-1`。
- 角色：`/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/roles?limit=-1`。
- 凭证：`/kapis/devops.kubesphere.io/v1alpha3/devops/<name>/credentials?limit=-1`。
- 上述三条 kapis 在工程不存在时返回 404 资源 not-found（说明路由存在）；写类接口不做，当前环境 webhook 不稳。
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

## 系统现状

老 console：`/:workspace/clusters/:cluster/devops` 列表（tenant API），详情 `…/devops/:devops` 下流水线/CD/代码仓库/基本信息/成员/角色/凭证七个页签，写操作齐备。新 UI 此前 registry 仅登记 planned 入口；本轮交付列表与详情骨架（只读），流水线类页签与写操作另立。

## 仓库落点

- 列表页：`apps/console-next/src/pages/devops/DevopsProjectsPage.tsx`
- 详情页：`apps/console-next/src/pages/devops/DevopsProjectDetailPage.tsx`
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

## 不变量

1. 列表行数 = CRD items 数；0 时显示空态。
2. 详情基本信息与 CRD 对象一致；404 显示 `:not-found`。
3. 每个页签独立：表格 / 空态 / 失败原因+重试三选一，读不到不得显示空表。
4. 页面不发出任何写请求。

## 已知坑

- **kapis 的 devopsprojects 是 404**：列表必须走 `apis/`；把 `/kapis/devops.../v1alpha3/devopsprojects` 当列表会得到 Page Not Found。
- **工程不存在时错误消息不带 kind 前缀**（IAM 路径返回 `devopsproject.devops.kubesphere.io "x" not found`，devops 路径返回复数），不要按字符串前缀判类型，只按 not-found 状态与消息判断。
- **`rules` 可能缺失**：角色页签的规则数按 `rules?.length ?? 0` 展示。
- **凭证的 type 位置不固定**：优先对象顶层 `type`，其次 `kind`；都没有显示 `-`。
- **空集群主路径**：B200 当前 0 个工程，列表空态与详情 not-found 是必测路径。
- **写操作不可用**：当前 webhook 不稳，本页不提供任何写入口。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01.yaml`
可观测点：列表 `devops:surface`、`devops:link:<name>`；详情 `devops-detail:surface/title/basic/not-found/tab:*` 与各页签的 `-table/-empty/-error/-retry` 句柄。

## 后续改进

- 流水线 / 持续部署 / 代码仓库页签（ks-devops 专属 API 与编辑器）。
- 工程的创建/删除与成员/角色/凭证写操作。
- 若 DevOps 改为按企业空间授权，按 DEC-01 的「何时重新考虑」调整为 workspace scope。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01
