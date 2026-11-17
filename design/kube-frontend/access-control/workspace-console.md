# 企业空间控制台 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/workspace-console.md)

## 概述

`/kube-frontend/workspaces/<ws>/{overview,projects,members}` 三页，属于新的 `workspace` 作用域。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01

## 设计目标与非目标

目标：把企业空间做成独立作用域（URL、侧栏、面包屑都分开）。非目标：成员邀请、配额、部门、联邦项目与应用商店（各自独立功能点）。
**已移出非目标**：DevOps 入口（2026-11-17 重纳，见 DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-16）、概览「集群信息」页签（同批重纳，见 DEC-…-17）。

## 关键约束

- 成员：`/kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspacemembers`（tenant 路径 404）。
- 项目：`/kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=<ws>`。
- 空间详情：`/kapis/tenant.kubesphere.io/v1alpha2/workspaces/<ws>`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01 — 新增 `workspace` 作用域，而不是挂在平台下

**为什么**：企业空间的侧栏是它自己的（概览/项目/成员），平台侧的 `访问控制` 侧栏属于另一个读者；把两者混在一处会让「我在哪个作用域」失去意义，也重现了老 console 特意分层的结构。
**被否方案**：在 `access/workspaces/<name>` 上加页签。那是平台管理员查看资产的角度，不是空间管理员的工作台。
**何时重新考虑**：若产品决定取消企业空间层级。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02 — 项目链接的 cluster 段取 placement 的首个集群

**为什么**：项目控制台 URL 必须带 cluster；企业空间的 `spec.placement.clusters` 就是它被放置的集群列表，空列表时回落 `host`。
**被否方案**：用「最后访问的集群」。跨空间跳转会把人带到没放这个空间的集群。
**何时重新考虑**：企业空间支持多集群项目视图时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-14 — 空间用量是向量，项目排行靠标签过滤

两个聚合的形态不同，实现必须分别处理：

- `GET /kapis/monitoring.kubesphere.io/v1alpha3/workspaces/<ws>` 返回 **vector**（每个指标一条样本），
  直接取 `value[1]`；
- 项目排行用的 `/kapis/monitoring.kubesphere.io/v1alpha3/namespaces` 是**集群级**排行，服务端不接受
  workspace 过滤参数（实测带 `workspace=` 仍返回全集群样本），因此按每条样本自带的 `workspace` 标签
  在客户端过滤——没有该标签的样本无法归属，直接跳过而不是猜。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-15 — 存储用量不显示

本部署没有空间级存储指标（探测不到该序列）。旧页面有存储一列，这里选择整行不出现，而不是显示 `-`：
「未测量」与「测到 0」是两件事，而一个永远为 `-` 的行只会让人以为坏了。
### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-16 — 企业空间恢复 DevOps 入口，原「模块未部署」理由作废

**新决定（2026-11-17 产品复核）**：在企业空间作用域内恢复 DevOps 入口，使空间管理员从自己空间进入就能看到该空间的 DevOps 工程，链接到集群作用域的工程详情仍可用。入口形态与空间概览的页签式入口一致（对照 `/workspaces/<ws>/overview/usage` 这类空间内页签）。

**为什么推翻原判断**：原登记写「DevOps / 联邦项目 / 应用商店：整块模块未部署」，该理由已不成立——DevOps 工程页族已在集群作用域交付（列表 + 详情七页签），缺的只是**空间作用域入口**与按 workspace 过滤。把「模块未部署」继续当作不做理由，会把已交付能力永久盖住（迁移指南 §2.3：判定能不能做要探测接口，不读模块开关）。

**被否方案（保留原记录）**：
1. 原方案 A「不做，入口只在集群作用域」（`gap_check.py` 曾标 `ELSEWHERE[workspaces/devops]`）。被否原因：产品复核认为租户内的入口是主路径；「别处承接」未经任务等价证明（空间内看不到「我这个空间有哪些工程」）。
2. 原方案 B「空间侧栏直接挂集群作用域的 DevOps 页」。被否原因：URL 与侧栏会跨作用域，面包屑与权限上下文都对不上。

**何时重新考虑**：若 DevOps 工程改为空间级资源（不再按集群归属）。

**落地约定**：
1. **作用域归属**：新路由在 `workspaces/$workspace/devops`，不带 cluster 段；列表按工程所属 workspace 过滤，数据仍读集群级集合。
2. **跨作用域链接**：行进入工程详情时跳集群作用域 URL（含 workspace/cluster 段），不复制详情页。
3. **空态与不可用分开**：该空间没有工程显示空态；DevOps 接口不可用显示「不可用」而不是空表（宪法「读不到被渲染成没有」）。

**交付与实现口径（2026-11-17）**：`US3` + `AC-…-09` + `TC-…-09`。列表按**集群逐个**读 kapis workspace 聚合 `/kapis/devops.../workspaces/<ws>/devops`（成员集群 `/kapis/clusters/<c>/devops...`），不用 raw `/apis/devopsprojects` 再按标签过滤：聚合是服务端按 workspace 过滤，口径与旧 console 一致，也不会把没授权的工程列出来。只查询 `status.configz.devops === true` 且就绪的集群（未启用 DevOps 的集群返回 404，不该把正常安装变成错误）；单集群失败保留其他集群行并显示部分失败提示，全部失败才是错误。行链接到集群作用域详情，创建/编辑/删除留在该详情（决策范围）。页面「无工程」与「集群都未启用 DevOps」分开说明。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-17 — 概览增加「集群信息」页签，原「无可用集群选择器」理由作废

**新决定（2026-11-17 产品复核）**：企业空间概览增加「集群信息」页签，以卡片展示该空间可见（被授权/被放置）的集群。多集群下只列该空间被授权的集群；单集群下显示单卡或隐藏页签。

**为什么推翻原判断**：原登记（能力矩阵 §0 空间概览行）写「旧『集群信息』页签不做（空间详情无可用集群选择器）」。产品复核认为：企业空间本身就有 `spec.placement.clusters`，这正是「这个空间部署在哪些集群」的事实来源，不需要额外的「集群选择器」——把缺少选择器当成缺少数据源，是把接口形态问题误判成能力不可得。当前实现只把 clusters 作为一行字段显示（`WorkspaceOverviewPage.tsx:82`），信息密度不足以回答「空间在哪些集群、各自什么状态」。

**被否方案（保留原记录）**：
1. 原方案 A「不做集群信息页签，只保留基本信息里的一行集群字段」。被否原因：多集群下这一行只能给出名字串，没有每集群的状态与进入入口。
2. 原方案 B「做一个集群选择器再渲染页签」。被否原因：概览是只读汇总，不需要「选中某个集群」的交互；选择器属于集群切换器，不属于概览。

**何时重新考虑**：若空间可见集群的判定改为独立授权资源（而非 placement + 可见性），卡片口径需同步改。

**落地约定**：
1. **口径**：卡片集合取空间 `spec.placement.clusters` 与该用户可见集群的交集；两者都读不到时显示「不可用」，不显示空卡片。
2. **单集群**：只有一个集群时显示单卡（不隐藏），避免多集群/单集群两种布局分叉。
3. **与 `AC-…-01` 的关系**：基本信息里原有的「部署集群」字段保留为事实行，页签提供每集群细节；不把同一事实做成两处主信息。

**实现口径（2026-11-17 mlu370 实测，替代上面的推测）**：`GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/system-workspace/clusters?limit=-1` 返回 200、2 条完整 Cluster 对象（`host` 与 `4paradigm`，含 `spec.provider`、`status.kubernetesVersion/nodeCount/conditions`）；同一部署的 workspace 对象**没有** `spec.placement.clusters`。因此卡片集合只取该聚合接口——它本身就是「该空间可见集群」的权威来源，不与该部署为空的 placement 求交；聚合读失败显示错误 + 重试，不显示空卡片。单集群仍显示单卡；卡片上的资源雷达图不再迁移，资源用量由卡片链接到的集群概览回答（documented in §DEC-17 的落地）。

**本决策的交付**：`AC-…-08` + `TC-…-08`；实现见 `WorkspaceOverviewPage.tsx` 的 `WorkspaceClustersSection`。

## 系统现状

老 console：`/workspaces/:ws/*` 18 条路由（概览、项目、成员、角色、部门、配额、DevOps、应用仓库等）。本页迁前三页；其余各自有独立功能点（角色、部门、配额、联邦项目、应用仓库）。
其中 **DevOps 入口** 与 **概览「集群信息」页签** 原登记为不做，2026-11-17 产品复核决定重纳（DEC-…-16、DEC-…-17），不再是「未部署模块」。

## 仓库落点

- 作用域：`areas/registry.ts` 的 `AreaScope` + `workspace` 区域
- 侧栏：`shell/AppShell.tsx` 的 `workspacePath` 分支
- 页面：`apps/console-next/src/pages/workspace/{WorkspaceOverviewPage,WorkspaceProjectsPage,WorkspaceMembersPage,WorkspaceDevopsPage}.tsx`
- 路由：`routes/kube-frontend.workspaces.$workspace/{overview,projects,members,devops}/`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 空间详情 | /kapis/tenant.kubesphere.io/v1alpha2/workspaces/&lt;ws&gt; |
| 空间可见集群 | /kapis/tenant.kubesphere.io/v1alpha2/workspaces/&lt;ws&gt;/clusters?limit=-1 |
| 集群使用率 | /kapis/monitoring.kubesphere.io/v1alpha3/cluster（host）或 /kapis/clusters/&lt;name&gt;/monitoring.kubesphere.io/v1alpha3/cluster（成员）?metrics_filter=...（clusterMetricsApi.usage；cluster 查询参数会被忽略） |
| 空间成员 | /kapis/iam.kubesphere.io/v1alpha2/workspaces/&lt;ws&gt;/workspacemembers |
| 空间 DevOps 工程 | /kapis/devops.kubesphere.io/v1alpha3/workspaces/&lt;ws&gt;/devops?limit=-1（成员集群加 /kapis/clusters/&lt;c&gt; 前缀） |
| 空间项目 | /kapis/resources.kubesphere.io/v1alpha3/namespaces?labelSelector=kubesphere.io/workspace=&lt;ws&gt; |

## 不变量

1. 概览的项目数/成员数 = 对应接口返回条数。
2. 项目链接含 workspace / cluster / project 三段。
3. 侧栏三项都在该作用域可达。
4. 集群卡片数量 = `workspaces/<ws>/clusters` 返回条数；missing 字段显示 `-`，不算 0；聚合失败显示错误 + 重试，不落成空卡片。
5. 基本信息「部署集群」优先取聚合返回的集群名，回落 workspace 对象的 placement；同一页不出现「部署集群 -」而集群页签有两张卡的自相矛盾。
6. 卡片使用率 = used/total 取整百分比；used 或 total 缺失、total≤0、非有限值都显示 `-`；监控失败只让该卡四项变 `-`，不改身份/就绪/链接。明细保留旧卡「已用/已分配/总量」三类事实（CPU/内存），容器组/磁盘为「已用/总量」；旧雷达图不再绘制。
7. DevOps 列表行集合 = 各就绪且 `configz.devops` 集群的 kapis workspace 聚合并集；未启用 DevOps 的集群不发请求；部分失败保留其余行。

## 已知坑

- **`AreaScope` 是联合类型**：新增作用域后，`areasFor` 与 shell 的 active 解析都要有分支，否则侧栏会落回项目菜单且不高亮。
- **成员接口不在 tenant 路径**：`/kapis/tenant.../workspaces/<ws>/members` 返回 404。
- **URL 段 `workspaces` 与工作空间名的冲突**：作用域根是字面量 `workspaces`；若真有同名工作空间，其控制台 URL 会与作用域根同形（当前无此对象）。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01.yaml`、`...-08.yaml`、`...-09.yaml`
可观测点：`workspace-overview:title/project-count/member-count`、`workspace-overview:tab:resources/clusters`、`workspace-overview:clusters[:list|:empty|:retry]`、`workspace-overview:clusters:card:<name>[:status|:provider|:version|:nodes|:link]`、`workspace-projects:surface`、`workspace-members:surface`、`workspace-devops:surface[:search|:refresh|:columns|:empty-no-devops|:partial|:retry]`、`workspace-devops:link:<cluster>:<name>`。
单测：`packages/api-client/test/workspace-clusters.test.ts`（映射与请求路径；Ready 缺条件=false、nodeCount 缺失≠0）。

## 后续改进

- 邀请/移除成员已由 [workspace-members.md](./workspace-members.md) 使用空间角色集合承接。
- 配额与部门。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09
