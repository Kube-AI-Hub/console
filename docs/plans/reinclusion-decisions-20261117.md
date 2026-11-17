# 批准不做 → 重新纳入迁移：决策记录与执行计划（2026-11-17）

> **决策来源**：产品复核 [批准不做清单](not-migrating-review-20261117.md) 后的口头决定，2026-11-17。
> **本文是这批重纳的唯一执行正文**：逐条写「决定了什么、现在什么状态、要做什么、依赖什么、怎么验收」。
> 登记侧（PRD 明确不做 / design DEC / `gap_check.py / 能力矩阵台账）按 §4 的清单同步。

---

## 0. 决策总览

**重新纳入迁移范围 14 条**：页面级 8 条 + 能力级 5 条 + 集群网关 1 条。
**保持不做 2 条**（N-04 支持页、N-08 集群列表卡片视图）。其余按原建议「先探测 / 保持」不动。

| 编号 | 项 | 决定 | 当前实现状态 | 工作量 |
| --- | --- | --- | --- | --- |
| N-01 | 项目内「应用」（自制 CRD composing） | **重纳** | 路由 `applications` 指向 appstore 的 `InstalledAppsPage`，**CRD 应用未实现** | 大（列表 + 详情 4 页签） |
| N-02 | 第三方登录 | **重纳**，在平台设置补入口 | 无路由、无页面 | 中（表单 + 接口探测） |
| N-03 | 资源消费统计（账单） | **重纳**，入口在浮动工具箱 | 无页面、无工具箱 | 中大（页面 + 工具箱壳） |
| N-05 | 集群 kubeconfig | **重纳** | **已实现**：`ClusterOverviewPage.tsx:123-125`（`overview:kubeconfig-open`） | 极小（只改登记） |
| N-06 | 集群作用域角色页 | **重纳**（mlu370 环境可测） | 无 `clusters/$cluster/roles` 路由 | 中（列表 + 详情两页签） |
| N-07 | 企业空间 DevOps 入口 | **重纳**，租户内有入口 | 无 `workspaces/$workspace/devops` 路由 | 小（列表页 + 入口） |
| N-09 | 企业空间概览「集群信息」页签 | **重纳** | 概览只把 clusters 当字段显示（`WorkspaceOverviewPage.tsx:82`） | 小（页签 + 卡片） |
| N-10 | 节点添加（改 kubeadm join） | **重纳；后端接口 + 控制台弹窗已交付，正向 E2E 待后端部署** | 无入口 | 中（kubekey 不存在，改由 ks-apiserver 签发 join 命令） |
| N-11 | 持久卷 编辑信息 / YAML / 删除 / 批量删除 | **重纳** | 只读 | 小（复用通用 YAML/删除弹窗） |
| N-12 | 存储类型 创建 / 编辑 / 删除 / 设为默认 / 卷功能 / 自动扩容 | **重纳** | 只读 | 中 |
| N-21 | 企业空间角色 CRUD | **重纳** | 只读（`WorkspaceRolesPage.tsx:24-25`） | 中（复用项目角色编辑器） |
| N-27 | 用户组 watch 实时刷新 | **重纳** | 无 watch（通道已建好） | 极小（接入 `useCollectionWatch`） |
| N-28 | 帮助 / 文档入口 | **重纳** | 顶栏无入口 | 小（可配置 URL + 兜底） |
| N-29 | 集群网关 创建/编辑/删除 + 详情 4 页签 | **重纳** | 只读 3 区块 | 大（依赖控制器就绪） |

---

## 1. 逐条执行说明

### N-01 项目内「应用」（自制 CRD composing）

- **现状**：`routes/.../projects.$namespace/applications/index.tsx:3,17` 渲染的是 appstore 的 `InstalledAppsPage`（已安装 Helm 应用），**不是老 console 的自制 CRD 应用**。
- **要做**：
  1. 列表：CRD 应用聚合（老 `Applications/CRDApps.jsx:29-33`）——按应用聚合 Deployment/StatefulSet/Service/Ingress，显示健康、组件数、创建时间。
  2. 详情 4 页签：组件 / 灰度 / 流量治理 / 链路追踪（老 `CRDAppDetail/routes.js`）。
  3. 与现有 appstore 应用页并存：两者不是同一功能，路由需分开（建议 `applications` 保留 appstore，新增 `crd-apps` 或在 `applications` 内分页签）。
- **依赖**：CRD 聚合读（`applications.app.kubesphere.io` 或按 label 聚合）；流量治理/链路追踪依赖 servicemesh 控制器——**本集群可能无数据**，需按环境阻塞登记而非不做。
- **验收**：列表健康数与组件数对得上；4 页签在无 servicemesh 时显示「本集群未上报」而不是空表。

### N-02 第三方登录（平台设置补入口）

- **现状**：`settings/` 下无 `third-login`；PRD `login.md:41`、`platform-settings/_index.md:69`、design `login.md:23` 三处登记不做。
- **要做**：
  1. 平台设置新增「第三方登录」页（老 `settings/containers/ThirdPartyLogin`：OAuth / GitHub OAuth / LDAP）。
  2. 入口放在 `platform-settings` 区域，与通知渠道并列。
- **依赖**：先按迁移指南 §2.3 探测——①老源码调哪个 API →②该组该版本是否被服务 →③实际读一次。历史结论「identityproviders 404」未记录版本与角色，需重测。
- **验收**：能读到当前配置；保存后回读一致；无权限时显示权限原因而不是空白。

### N-03 资源消费统计（账单）+ 浮动工具箱

- **现状**：无 `bill` 页面；无浮动工具箱（老 `components/KubeTools`，右下角悬浮球，6 个工具）。
- **要做**：
  1. **浮动工具箱壳**：右下角可拖拽悬浮球，展开 6 个入口（日志查询 / 事件检索 / 审计检索 / 资源消费统计 / kubeconfig / kubectl），位置记忆 `localStorage`。
  2. **资源消费统计页**：老 `containers/Bill`（`/bill`），按项目/时间区间看 CPU/内存/存储消费。
- **依赖**：metering 接口——历史登记「部署未启用计量组件，路由 404」。**先探测**；若确实无数据源，页面要如实显示「本集群未启用计量」而不是空表。
- **验收**：工具箱在任意页可见、可拖拽、位置持久；6 个入口都能到达；账单页在无计量时给明确说明。

### N-05 集群 kubeconfig（已实现，只改登记）

- **现状**：`ClusterOverviewPage.tsx:123-125` 已有 `overview:kubeconfig-open` 按钮，点击打开 `UserKubeconfigDialog`（按当前用户取 kubeconfig）。
- **要做**：**只改登记**——从「批准不做」改为「已交付」，并在文档写明入口在集群概览的常用运维入口区块。
- **注意**：老 console 的 `/clusters/:c/kubeConfig` 是独立页；新实现是弹窗。这属「有替代」，需在 `gap_check.py` 标 `ELSEWHERE` → 已迁移。

### N-06 集群作用域角色页（mlu370 可测）

- **现状**：集群作用域无 `roles` 目录；角色只在平台「访问控制 › 集群角色」，且固定读 host 集群。
- **要做**：
  1. `clusters/$cluster/roles` 列表 + `$name` 详情（权限规则 + 已授权用户两页签，老 `clusters/containers/Roles`）。
  2. 平台角色页的多集群切换（当前固定 host）。
- **依赖**：mlu370 环境用于多集群验证。
- **验收**：在 mlu370 上切换集群后，角色列表随集群变化；两页签内容正确。

### N-07 企业空间 DevOps 入口

- **现状**：`gap_check.py` 把 `workspaces/devops` 标为 `ELSEWHERE`（落点在集群作用域）；企业空间下无 devops 入口。
- **要做**：在租户（企业空间）内恢复 DevOps 入口——参考用户指出的路径形态 `/workspaces/<ws>/overview/usage` 说明租户内有页签式入口，DevOps 应作为同类入口出现。
- **依赖**：DevOps 工程列表已存在于集群作用域（`clusters/$cluster/devops`），需按 workspace 过滤。
- **验收**：从企业空间进入能看到该空间的 DevOps 工程；链接到集群作用域的工程详情仍可用。

### N-09 企业空间概览「集群信息」页签

- **现状**：`WorkspaceOverviewPage.tsx:82` 把 clusters 作为一行字段显示，没有「集群信息」页签。
- **要做**：概览增加「集群信息」页签，卡片展示该空间可见的集群（老 `workspaces/containers/Overview/Clusters`）。
- **验收**：多集群下只列该空间被授权的集群；单集群下隐藏或显示单卡。

### N-10 节点添加（kubeadm join）

- **现状**：无入口；KubeKey 组/CRD 在 B200、mlu370 均 404，kube-server 无 KubeKey 集成。
- **已做**：kube-server 新增 `POST /kapis/resources.kubesphere.io/v1alpha3/nodes/join-command`，签发 24h bootstrap token 并返回带 CA hash 的 kubeadm join 命令；Go 单测 3 条通过（见 [节点加入后端记录](../node-add-backend-20261117.md)）。
- **待做**：控制台「添加节点」弹窗（展示/复制命令、404=后端需升级、403=无权限）。
- **验收**：AC-…-NODES-12；后端未升级时给出可行动说明而不是伪装不可用。

### N-11 持久卷写能力

- **要做**：编辑信息、编辑 YAML、删除、批量删除（老 `Storage/PV/index.jsx:47-111`）。
- **约束**：Bound/Released 状态的 PV 禁止删除，与老 console 一致；删除需输入名称确认。
- **验收**：Bound 时删除按钮禁用并说明原因；批量删除跳过不可删项并汇总。

### N-12 存储类型写能力

- **要做**：创建、编辑信息、编辑 YAML、删除、批量删除、设为默认、卷功能管理、自动扩容（老 `StorageClasses/index.jsx:42-191`）。
- **约束**：有 PVC 依赖时删除被拦截（老实现有此逻辑，新实现必须保留）。
- **验收**：删除被依赖的存储类型时给出「有 N 个 PVC 在使用」而不是失败弹窗。

### N-21 企业空间角色 CRUD

- **要做**：创建（可从模板复制）、编辑信息、编辑权限规则、删除（老 `workspaces/containers/Roles`）。
- **复用**：项目角色的 `RoleCreateDialog` / `RolePermissionsDialog`。
- **验收**：创建后回读；模板角色只读；删除有确认。

### N-27 用户组 watch 实时刷新

- **要做**：部门树接入 `useCollectionWatch`（通道已建好，目前全仓只有 `ClusterPodsPage` 接入）。
- **验收**：另一处改动部门后，本页无需刷新即更新。

### N-28 帮助 / 文档入口

- **要做**：顶栏帮助入口，指向可配置的文档 URL（`kube-docs` 或部署配置的地址），无配置时不显示而不是死链。
- **验收**：未配置文档地址时入口不出现；配置后新窗口打开。

### N-29 集群网关（重纳）

- **现状**：集群网关只读 3 区块；详情缺监控/日志/资源状态/元数据 4 页签。
- **要做**：创建、编辑、删除；详情补 4 页签（老 `Gateway/Detail/routes.js:27-58`）。
- **依赖**：**控制器就绪是前置**——当前缺 Helm chart，Gateway 只能到 `Deployed=True`。按「环境阻塞」推进：代码可先写，验收等控制器。
- **验收**：控制器就绪后网关能创建到 Ready；未就绪时页面明确说明缺什么。

---

## 1.5 接口可行性静态核查（2026-11-17，来自老源码）

> 迁移指南 §2.3 要求判定「能不能做」先看老源码调哪个 API。以下是重纳项的接口线索，
> **尚未对部署实测**（本地 BFF 8092 登录返回空、上游不可达），实现前仍需按 §2.3 的 ②③ 步实测。

| 项 | 老源码里的数据源 | 结论 |
| --- | --- | --- |
| **N-02 第三方登录** | @src/core/containers/Login/index.jsx:428@ 读 @globals.oauthServers@；@src/pages/settings/containers/ThirdPartyLogin/index.jsx@ 只**展示**服务端注入的配置，「配置」按钮打开的是**说明弹窗**，没有任何写请求 | **不是写接口**：重纳它 = 在平台设置里**只读展示**第三方登录配置 + 配置说明。BFF 需暴露 @oauthServers@（当前 BFF 未提供）。工作量从「中」下调为**小** |
| **N-03 资源消费统计** | @src/stores/meter/base.js:53-60@：@kapis/metering.kubesphere.io/v1alpha1@（多集群带 @clusters/<id>@ 前缀）；租户侧 @kapis/tenant.kubesphere.io/v1alpha2@ | 路径明确；历史「404」结论**未记录版本与角色**，需重测。页面必须能表达「本集群未启用计量」 |
| **N-10 节点添加** | @src/actions/node.js:33-66@：@apis/kubekey.kubesphere.io/v1alpha1@ 的 Cluster 对象 + @api/v1/namespaces/kubekey-system/configmaps/kubekey-parameters@；做法是读 Cluster 模板、往 @spec.hosts@ / @spec.roleGroups@ 追加后整体 update | 依赖 KubeKey CRD 是否存在。**非 KubeKey 集群应隐藏入口** |
| **N-29 集群网关** | 老 @gateway.kubesphere.io/v1alpha1@ 的 Gateway 对象 | 控制器缺 chart（已登记）；代码可先写，验收等环境 |

---

## 2. 与既有登记的关系

| 项 | 原登记位置 | 改成 |
| --- | --- | --- |
| N-01 | `migration-status-20261116.md` §3 别处承接；`capability-matrix.md` CHECK-09 | 移出别处承接 → 待补 |
| N-02 | `gap_check.py` `UNMIGRATED[settings/third-login]`；`migration-status` §2；PRD `login.md:41`、`platform-settings/_index.md:69`；design `login.md:23` | 删除不做登记 → 待补 |
| N-03 | `migration-status` §2 账单/计量；`capability-matrix` §3.1 | 删除不做登记 → 待补 |
| N-05 | `gap_check.py` `UNMIGRATED[clusters/kubeconfig]` | → 已迁移（弹窗承接） |
| N-06 | `capability-matrix` R-12；`prd/.../platform-roles.md:63`；`design/.../platform-roles.md` DEC-06 | 删除不做登记 → 待补 |
| N-07 | `gap_check.py` `ELSEWHERE[workspaces/devops]` | → 待补（恢复租户入口） |
| N-09 | `capability-matrix.md:59` | → 待补 |
| N-10 | `_gap/40-cross-cutting.md` 创建矩阵「未核实」 | → 待补 |
| N-11 | `_gap/20-cluster.md:100` | → 待补 |
| N-12 | `_gap/40-cross-cutting.md` C-13 | → 待补 |
| N-21 | `_gap/40-cross-cutting.md` C-14 | → 待补 |
| N-27 | `capability-matrix.md:30` | → 待补 |
| N-28 | `capability-matrix` CHECK-09；`_gap/40-cross-cutting.md` C-19 | → 待补 |
| N-29 | `prd/.../cluster-management/_index.md`；`_gap/20-cluster.md` | → 待补（环境阻塞：控制器） |

---

## 3. 执行顺序建议

| 阶段 | 项 | 理由 |
| --- | --- | --- |
| **第 1 批（无外部依赖）** | N-05（改登记）、N-27（接 watch）、N-11、N-12、N-21 | 纯前端 + 已有接口，可当天验证 |
| **第 2 批（需探测）** | N-02、N-03、N-10 | 先按指南 §2.3 探测接口，再决定页面形态 |
| **第 3 批（结构改动）** | N-06、N-07、N-09、N-28 | 路由与入口调整 |
| **第 4 批（大件）** | N-01、N-29 | 依赖 servicemesh / 网关控制器；代码可先写，验收等环境 |

**跨批前置**：N-03 的浮动工具箱是 N-02/N-03 的共同壳，建议单独作为一个单元先落地。

---

## 4. 登记同步清单（每项完成后必须做的四件事）

1. `prd/kube-frontend/**` 删掉对应「明确不做」条目，补 `US`/`AC`。
2. `design/kube-frontend/**` 改 `DEC-*`，**保留原「被否方案」并写清「2026-11-17 产品决定重纳」**。
3. `prd/tools/gap_check.py` 的 `UNMIGRATED`/`ELSEWHERE` 改到 `PLANNED`（或迁移后自动判为已迁移）。
4. `docs/plans/capability-matrix.md` §0 台账加 CHECK 行，指向本条记录。

门禁：`python3 prd/tools/check_docs.py --strict`、`python3 prd/tools/gap_check.py --strict`。

---

## 5. 登记落地状态（2026-11-17 已完成）

**14 项全部登记完成**，共改动 **30 个 PRD/design 文件** + 3 个工具/台账文件。

| 批次 | 覆盖项 | 状态 | 门禁 |
| --- | --- | --- | --- |
| 项目/企业空间 | N-01、N-07、N-09、N-21、N-27（10 文件） | ✅ 完成 | check_docs 0/0 |
| 平台/壳层 | N-02、N-03、N-28、N-05（6 文件） | ✅ 完成 | check_docs 0/0 |
| 集群 | N-06、N-10、N-11、N-12、N-29（14 文件） | ✅ 完成 | check_docs 0/0 |

**工具与台账同步**：

| 文件 | 改动 |
| --- | --- |
| @prd/tools/gap_check.py@ | 明确不做 **2 → 0**；@kubeconfig@ 归入「别处承接」（集群概览弹窗承接）；@third-login@ 归入「已登记缺口」 |
| @prd/tools/parity_check.py@ | 新增 @PLANNED@ 类别（「已重纳、待实现」），@ThirdPartyLogin@ 从「不做」迁入；未登记页 **1 → 0** |
| @docs/plans/capability-matrix.md@ | 新增 **CHECK-11**（重纳批次）；作废 N-09 的「空间详情无可用集群选择器」理由 |
| @docs/plans/not-migrating-review-20261117.md@ | 14 条标 ✅重纳、2 条标 ⛔保持不做 |

**统一写法**：每条 design 的 @DEC-*@ 都保留原「被否方案」逐字记录，并注明「2026-11-17 产品复核决定重纳」——符合迁移指南 §4「推翻旧判断不要删旧理由」。

---

## 6. 仍未完成的两件事（不要当成已交付）

### 6.1 AC / TC 全部待补（14 项）

本轮只做**登记**，没有造不跑的用例：@check_docs.py@ 要求每条 AC 必须有用例 @covers@、每条 US 必须被 TC 的 @story@ 引用，只补 AC 不补 TC 会直接把门禁打红。

建议编号（已核全仓唯一，实现批次一并落地）：

| 项 | 建议 AC |
| --- | --- |
| N-06 | @AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01@ |
| N-10 | @AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-12@ |
| N-11 | @AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03@ |
| N-12 | @AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04@ |
| N-29 | @AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03@ / @GATEWAY_DETAIL-02@ |
| N-02 | @AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01@ |
| N-03 | @AC-L3-KUBE-FRONTEND-TOOLBOX-BILL-01@、@AC-L3-KUBE-FRONTEND-TOOLBOX-SHELL-01@ |
| N-28 | @AC-CORE-KUBE-FRONTEND-HELP-01@ |

### 6.2 N-01 还缺一个功能树节点

@prd/tools/tree.py@ 里没有「自制 CRD 应用」的功能点，因此它的 PRD/design 只能写在 @app-store/project-apps.md@ 里作为约束条与 DEC。
建节点（建议路由段 @crd-apps@）后才能写 US/AC/TC——**这一步没做，N-01 无法进入实现批次**。
