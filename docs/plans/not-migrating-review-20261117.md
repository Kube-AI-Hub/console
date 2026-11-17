# 批准不做清单（2026-11-17）— 待你复核

> **这份文件的用途**：把仓库里所有「批准不做 / 别处承接」的登记摊平，供产品决策者逐条判断
> **哪些需要重新纳入迁移范围**。
>
> 登记散落在 6 处：`prd/kube-frontend/**` 的「明确不做」、`design/kube-frontend/**` 的「明确不做」、
> `prd/tools/gap_check.py` 的 `UNMIGRATED`/`ELSEWHERE`、`docs/plans/capability-matrix.md` §0 台账、
> `docs/plans/migration-status-20261116.md` §2/§3、`docs/plans/_gap/*` 的 2026-11-17 复验节。
> 本文件是它们的合并视图，**不新增结论**；每条都给出登记出处，可回溯。
>
> **复核基线**：2026-11-17，HEAD `3ee0da93d` 工作树。

---

## ⚑ 复核结果（2026-11-17，产品已决定）

**重纳 14 条**，执行正文见 [`reinclusion-decisions-20261117.md`](reinclusion-decisions-20261117.md)：

| 决定 | 条目 |
| --- | --- |
| **重纳**（14） | N-01、N-02、N-03、N-05、N-06、N-07、N-09、N-10、N-11、N-12、N-21、N-27、N-28、N-29 |
| **保持不做**（2） | N-04 支持页、N-08 集群列表卡片视图 |
| 未表态（按原建议不动） | N-13/N-16/N-22/N-24/N-26/N-33「先探测」；其余「保持不做」 |

> 其中 **N-05 集群 kubeconfig 已实现**（集群概览「常用运维入口」→ kubeconfig 弹窗，`ClusterOverviewPage.tsx:123-125`），只需修正登记。
> `gap_check.py` 已同步：**明确不做 2 → 0**，kubeconfig 归入「别处承接」，第三方登录归入「已登记缺口」。

---

## 0. 怎么读这份清单

- **「理由强度」是我按迁移指南 §2.3（探测接口，不读模块开关）和 §4（别处承接须证明任务等价）做的初判**，不是结论。三档：
  - **强**：产品取舍或已探测的接口事实，理由成立。
  - **弱**：理由依赖未验证的假设（模块开关、单版本 404、未实际请求），**建议先探测再定**。
  - **环境**：因为部署缺组件而做不了，**不是产品决策**——环境修好后应自动回到待办。
- **「建议」** 是我的推荐，你可直接改。四档：**保持不做** / **建议重纳** / **先探测** / **改为环境阻塞**。
- 纯交互取舍（列宽拖拽、页签是否独立 URL、文案位置等）不在本清单正文，见 §6 附录 B 的说明。

## 1. 总览

| 类别 | 条数 | 说明 |
| --- | ---: | --- |
| 页面级批准不做 | 10 | 整个页面不做 |
| 能力级批准不做 | 23 | 页面在，但某类写/读能力不做 |
| 别处承接（需等价证明） | 3 | 换了落点，需确认任务等价 |
| **正文合计** | **36** | 本文件 §2–§4（10 + 23 + 3） |
| 附录 A：PRD「明确不做」中会删掉用户能力的条目 | 203 | 逐条列出，按模块分组 |
| 附录 B：纯交互取舍 | 约 290 | 只给计数与检索命令，不逐条列 |

**我的建议分布（33 条有效条目 + 3 条别处承接，后者与 N-01/N-06/N-07 是同一件事）：**
**7 条建议重纳**（N-01、N-09、N-11、N-12、N-21、N-27、N-28）· **9 条建议先探测**（N-02、N-07、N-10、N-13、N-16、N-22、N-24、N-26、N-33）· **1 条应改判为环境阻塞**（N-29）· **16 条保持不做**。

> 注：通知渠道筛选条件 `alertSelector` 已在 2026-11-17 复验中判为**待补**（不是批准不做），故不在本表；
> 它仍是当前最重要的通知类缺口。

---

## 2. 页面级批准不做（10 条）

| # | 页面 | 用户做不到什么 | 登记出处 | 现有理由 | 理由强度 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| N-01 ✅**重纳** | **项目内「应用」（CRD composing）** 列表 + 详情 4 页签 | 看不到自制 CRD 应用的聚合健康、组件下钻、流量治理、链路追踪 | `migration-status-20261116.md:24`、`capability-matrix.md` CHECK-09 | 「→扩展资源 别处承接」 | **弱（已被复验证伪）** | **建议重纳** |
| N-02 ✅**重纳**（平台设置补入口） | 第三方登录 `/settings/third-login` | 无法在控制台配置 OAuth / GitHub OAuth / LDAP | `gap_check.py` `UNMIGRATED`、`migration-status-20261116.md:14` | 登录方式由服务端注入，控制台无写入路径；部署无可配置身份源 | **弱**（依赖 `identityproviders` 探测，未记录版本与角色） | **先探测** |
| N-03 ✅**重纳**（浮动工具箱入口） | 账单 / 计量 `/bill` | 看不到资源消费统计 | `migration-status-20261116.md:15` | 部署未启用计量组件，页面没有数据源 | 强（metering 路由 404 已探测） | 保持不做（环境类，组件启用后重评） |
| N-04 ⛔**保持不做** | ~~支持页 `/support`~~ | — | `capability-matrix.md` CHECK-09 | 外链集合，产品内不做聚合页；2026-11-17 已从源码删除 | 已关闭（源码删除，不再是缺口） | — |
| N-05 ✅**重纳**（已实现，入口在集群概览） | 集群 kubeconfig 读取/轮换 `/clusters/:c/kubeConfig` | 不能查看/轮换集群 kubeconfig | `gap_check.py` `UNMIGRATED`、`area-migration-plan.md` §7.3 | 读接口 405；导入更新已迁移 | 强（有探测） | 保持不做（记录复查条件） |
| N-06 ✅**重纳**（mlu370 可测） | 集群作用域的独立角色页 | 不能在集群视角管理集群角色 | `capability-matrix.md` R-12、`prd/.../platform-roles.md:63` | 与平台角色是同一批 `clusterrole` 对象 | 强（信息架构）；**但平台角色页固定读 host 集群**，多集群下需先支持切换 | 保持不做 + 补「多集群切换」待办 |
| N-07 ✅**重纳**（租户内有入口） | 企业空间 DevOps | 从企业空间看不到 DevOps 工程列表 | `gap_check.py` `ELSEWHERE` | 落点在集群作用域 `/clusters/<c>/devops` | **中**（信息架构变化，企业空间用户少一条入口） | 先探测（问真实用户从哪进） |
| N-08 ⛔**保持不做** | 集群列表卡片视图 + host/成员分组 | 只能表格 + 「集群类型」筛选，无卡片视图 | `prd/.../cluster-list.md`、`capability-matrix.md` | 10 条/页表格已能一屏看完，卡片把状态与版本挤进图标 | 强（产品取舍） | 保持不做 |
| N-09 ✅**重纳** | 企业空间概览「集群信息」页签 | 看不到该空间关联的集群卡片 | `capability-matrix.md:59` | 空间详情无可用集群选择器 | **弱**（是「没做选择器」，不是「不需要」） | **建议重纳** |
| N-10 ✅**重纳** | 节点添加（KubeKey） | 不能从控制台给 KubeKey 集群加节点 | `_gap/40-cross-cutting.md` 创建矩阵「未核实」 | **无登记理由** | **弱（无理由）** | **先探测** |

---

## 3. 能力级批准不做（23 条）

| # | 能力 | 用户做不到什么 | 登记出处 | 现有理由 | 理由强度 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| N-11 ✅**重纳** | **持久卷 编辑信息 / 编辑 YAML / 删除 / 批量删除** | PV 只能看 | `_gap/20-cluster.md:100` | 「属基础设施操作」 | **弱**（无探测；PV 有 Bound/Released 保护可做） | **建议重纳（至少 YAML + 删除）** |
| N-12 ✅**重纳** | **存储类型 创建 / 编辑信息 / 删除 / 设为默认 / 卷功能 / 自动扩容** | 存储类只能安装期定 | `_gap/40-cross-cutting.md` C-13 | 「属基础设施操作」 | **弱** | **建议重纳（至少 YAML + 设为默认）** |
| N-13 | **日志接收器 创建 / 编辑** | 日志收集只能看不能改 | `page-parity-report.md:37`、`_gap/20-cluster.md:149` | 需要专门的编辑与校验流程 | 中 | 先探测（fluentbit CR 直写可行性） |
| N-14 | 项目配额 / LimitRange **编辑**（集群侧项目详情） | 集群视角改不了项目配额 | `_gap/20-cluster.md:163` | 写操作回项目作用域 | 强（避免两个编辑入口） | 保持不做 |
| N-15 | **自定义监控面板编辑器** | 不能新建/编辑仪表板 | `capability-matrix.md:77`、`prd/.../custom-monitoring` | 完整 Grafana 编辑器另立单元 | 中 | 保持不做（另立单元） |
| N-16 | **告警消息 静默 / 通知 / 批量删除** | 不能对告警静默或通知 | `prd/.../monitoring/alerts.md:61` | 消息生命周期归告警控制器 | 中 | 先探测（静默是运营刚需） |
| N-17 | 概览「提示卡片」（如何邀请成员 / 如何设置网关） | 新用户没有引导卡 | `design/.../project-settings/overview.md:36-38` | 一次性内容占据常驻位置 | 强（产品取舍） | 保持不做 |
| N-18 | 概览「应用列表」（openpitrix） | 概览看不到应用列表 | 同上 | 依赖 openpitrix | 强 | 保持不做 |
| N-19 | 版本差异对比（diff）与「再次部署」指定副本/镜像 | 只能看版本表与回滚 | `page-parity-report.md:98` | 无 diff 组件 | 中 | 保持不做 |
| N-20 | **平台 / 企业空间角色「规则的多条编辑」** | 一次只能编辑一条规则 | `prd/.../platform-roles.md:62`、`access-control/_index.md:88` | 当前一次一条 | 中 | 保持不做 |
| N-21 ✅**重纳** | **企业空间角色 CRUD** | 空间内不能建/改/删角色 | `_gap/40-cross-cutting.md` C-14 | 源码自述理由 | **弱** | **建议重纳** |
| N-22 | **联邦项目：网关 / 日志收集 / 配额 / 成员 四类页签 + 逐集群 overrides 编辑器** | 联邦项目看不到网关/日志/配额/成员 | `capability-matrix.md:37` | 「各自页族承接」 | **弱**（联邦是另一套对象，等价性未证） | **先探测** |
| N-23 | 联邦对象的编辑 / 创建 / 删除 | 联邦资源只读 | `prd/.../federated-projects.md:138` | 对齐老 console 只在联邦控制面维护 | 强 | 保持不做 |
| N-24 | 通知渠道「用户级订阅」 | 用户不能自选订阅哪些告警 | `prd/.../platform-settings/*` | — | 中 | 先探测 |
| N-25 | 用户头像 | 列表/详情用「用户名 + 邮箱副行」识别 | `prd/.../user-detail.md`、`users.md` | 用户对象没有 avatar 字段 | 强 | 保持不做 |
| N-26 | 企业空间级配额 CR 编辑 | 只能看项目 × 资源只读表 | `capability-matrix.md:29` | 空间级 CR 编辑批准不做 | 中 | 先探测 |
| N-27 ✅**重纳** | 用户组 watch 实时刷新 | 部门树不自动更新 | `capability-matrix.md:30` | — | **弱**（watch 通道已建好） | **建议重纳**（成本极低） |
| N-28 ✅**重纳** | 帮助 / 文档外链 | 顶栏没有任何文档出口 | `capability-matrix.md` CHECK-09 | 部署无文档站点，链接会落到 SPA 兜底页 | **弱**（仓库有 `kube-docs`，且可配置 URL） | **建议重纳** |
| N-29 ✅**重纳** | 集群网关 创建 / 编辑 / 删除 + 详情 4 页签 | 集群网关只能看 3 个区块 | `prd/.../cluster-management/_index.md` | 控制器缺 Helm chart，状态到不了就绪 | **环境**（不是产品决策） | **改为环境阻塞** |
| N-30 | 组件 启停 / 扩缩容 / YAML 编辑 / 重启 / 日志 | 系统组件不能从控制台运维 | `prd/.../cluster-management/_index.md` | 生命周期归 KubeSphere 安装器 | 强（产品取舍） | 保持不做 |
| N-31 | CRD 创建 / 编辑 / 删除（CRD 本身，非实例） | 不能从控制台管理 CRD | 同上 | 属安装器职责 | 强 | 保持不做 |
| N-32 | 审计导出 `/auditing/events/export` | 审计日志不能导出 | `prd/.../cluster-management/audit-search.md` | 接口实测 404 | 强（有探测） | 保持不做 |
| N-33 | 流水线运行停止/终止、Jenkins 队列、批量运行/删除、CD 全写能力、代码仓库编辑、工程角色 CRUD | DevOps 只覆盖创建/编辑/触发/日志 | `prd/.../cluster-management/*` DevOps 段 | 「不在本轮」 | **弱**（「不在本轮」不是理由，是排期） | **先探测**（逐项确认是排期还是不做） |

---

## 4. 别处承接（3 条，需证明任务等价）

按迁移指南 §4，「别处承接」必须给出目标路由**并逐项核对指标、默认筛选、排序、权限、操作、单位和下钻**，否则不能关闭该能力。

| # | 老入口 | 新落点 | 等价性核对结论 | 建议 |
| --- | --- | --- | --- | --- |
| E-01 | 项目内「应用」（CRD composing） | 扩展资源 / 应用商店 | **不等价**：扩展资源是通用 CRD 浏览器，无聚合健康、组件下钻、流量治理、链路追踪 | **建议重纳**（同 N-01） |
| E-02 | 企业空间 DevOps | 集群作用域 `/clusters/<c>/devops` | 功能等价，但**入口消失**：企业空间用户少一条路径 | 先探测（同 N-07） |
| E-03 | 集群角色 | 平台「访问控制 › 集群角色」 | 对象等价；但平台页**固定读 host 集群**，多集群下不等价 | 保持 + 补多集群切换待办（同 N-06） |

---

## 5. 建议优先复核的 9 条（我的推荐顺序）

| 顺序 | 条目 | 为什么值得先看 |
| --- | --- | --- |
| 1 | **N-01 / E-01 自制 CRD 应用** | 唯一被复验**证伪**的承接理由——登记本身是错的，不是取舍 |
| 2 | **N-11 / N-12 持久卷与存储类型的写能力** | 理由只有一句「属基础设施操作」，从未探测；有 Bound 保护可安全实现删除 |
| 3 | **N-21 企业空间角色 CRUD** | 空间内建不了角色，直接影响租户自助 |
| 4 | **N-28 帮助 / 文档入口** | 成本极低，理由（无文档站点）与仓库现状不符 |
| 5 | **N-27 用户组 watch** | 通道已建好，只有 1 页接入；这页接上去是几行 |
| 6 | **N-09 企业空间「集群信息」页签** | 理由是「没有选择器」= 没做，不是不做 |
| 7 | **N-29 集群网关** | 应从「批准不做」改判为「环境阻塞」，否则控制器装好后没人记得回来做 |
| 8 | **N-22 联邦四类页签** | 「各自页族承接」对联邦对象不成立，需证明等价 |
| 9 | **N-02 第三方登录** | 老 console 有完整表单，理由依赖未记录的探测结论 |

---

## 6. 附录 A：PRD「明确不做」中会删掉用户能力的条目（203 条）

> 从 `prd/kube-frontend/**/*.md` 的 `## 明确不做` 小节脚本抽取 495 条，按「是否删掉一项用户可执行的能力」
> 过滤（含 创建/编辑/删除/导入/导出/批量/上传/下载/扩容/快照/回滚/静默/订阅/绑定/邀请/移除/重置 等动词）
> 得 203 条；其余 292 条属交互与展示取舍，见附录 B。
>
> 每条格式：`文件:行号` + 原文（截断至 160 字）。**这些是逐页的具体登记，多数是 §2/§3 大决策在各页的落地表述。**

### _root（1）

- [`_index.md:98`](../../_index.md#L98) 不在首期实现创建 / 编辑表单与其他资源模块。

### access-control（25）

- [`access-control/_index.md:87`](../../access-control/_index.md#L87) 企业空间的创建与编辑：见企业空间列表/详情的明确不做。
- [`access-control/_index.md:88`](../../access-control/_index.md#L88) 角色规则的多条编辑（当前一次一条）。
- [`access-control/federated-projects.md:138`](../../access-control/federated-projects.md#L138) 不做联邦对象的编辑/创建/删除（联邦资源详情仍只读；对齐老 console 只在联邦控制面维护）：本功能点只深化只读信息与事件。
- [`access-control/federated-projects.md:142`](../../access-control/federated-projects.md#L142) 不做「添加集群」的逐集群覆盖（overrides）编辑界面；调整部署集群只改放置集合，overrides 仅同步注解。
- [`access-control/federated-projects.md:144`](../../access-control/federated-projects.md#L144) 不做批量删除的单个失败重试按钮：失败原因保留在确认框，列表刷新后由读者再次选择。
- [`access-control/platform-roles.md:62`](../../access-control/platform-roles.md#L62) 规则的多条编辑（当前一次一条）。
- [`access-control/platform-roles.md:63`](../../access-control/platform-roles.md#L63) 集群作用域单独的角色列表 / 详情页：集群角色与平台角色是同一批 `clusterrole` 对象，统一在「访问控制 › 平台角色」维护，避免同一对象出现两个编辑入口（见 `page-parity-report.md` 的「同一对象只有一处编辑入口」）。老 console 在 `/clusters/:cluster/r
- [`access-control/user-detail.md:80`](../../access-control/user-detail.md#L80) 停用/启用、编辑信息与删除：在用户列表的行操作里完成。
- [`access-control/user-detail.md:82`](../../access-control/user-detail.md#L82) 不把个人设置的「改自己的密码」（必须填当前密码）做成详情上的重置。
- [`access-control/user-detail.md:83`](../../access-control/user-detail.md#L83) 不做后台定时清理登录记录：清理只在登录写入时按用户同步执行。
- [`access-control/user-detail.md:84`](../../access-control/user-detail.md#L84) 不做一次性批量清理历史遗留记录：只影响此后登录的用户。
- [`access-control/users.md:94`](../../access-control/users.md#L94) 企业空间成员、用户组、配额与跨作用域授权不在本页，见访问控制其它功能点。
- [`access-control/users.md:95`](../../access-control/users.md#L95) 不把个人设置的改密流程搬到列表（列表/详情的重置不填当前密码）。
- [`access-control/workspace-console.md:53`](../../access-control/workspace-console.md#L53) 邀请/移除成员不属于本只读规格，已由 [workspace-members.md](./workspace-members.md) 使用空间角色列表承接。
- [`access-control/workspace-detail.md:59`](../../access-control/workspace-detail.md#L59) 企业空间成员与角色：其 API 属于另一个聚合（且 `/workspaces/<name>/members` 在本集群返回 404），未迁移前不显示空表——空表会被读成「没有任何人有权限」。
- [`access-control/workspace-detail.md:60`](../../access-control/workspace-detail.md#L60) 企业空间编辑/删除：需要写接口与配额联动，另立功能点。
- [`access-control/workspace-members.md:85`](../../access-control/workspace-members.md#L85) 不删除平台用户，不编辑角色权限规则，不管理项目角色绑定。
- [`access-control/workspace-members.md:86`](../../access-control/workspace-members.md#L86) 邀请不改成旧页的用户搜索弹窗（继续输入用户名 + 存在性 GET）。
- [`access-control/workspace-quota.md:63`](../../access-control/workspace-quota.md#L63) 配额编辑（写）：属于项目详情页；本页只读。
- [`access-control/workspace-quota.md:64`](../../access-control/workspace-quota.md#L64) 用量趋势/图表：需要监控后端，本页只显示 ResourceQuota 的 `status.used` 快照。
- [`access-control/workspace-role-detail.md:61`](../../access-control/workspace-role-detail.md#L61) 编辑角色信息、编辑权限规则、删除角色：写路径需要 RBAC 编辑器与权限模型，另立。
- [`access-control/workspace-role-detail.md:63`](../../access-control/workspace-role-detail.md#L63) 逐成员解除绑定：在成员页做，详情页只读计数。
- [`access-control/workspace-roles.md:56`](../../access-control/workspace-roles.md#L56) 角色的创建与编辑（信息/权限/删除）：写路径是 IAM 聚合与原生 RBAC 两条，均需单独设计表单与校验；本页不提供按钮，避免出现「点了没反应」的假入口。
- [`access-control/workspace-roles.md:57`](../../access-control/workspace-roles.md#L57) 角色详情页（老 console 的 `/workspaces/:ws/roles/:name`）：规则明细表需要规则级编辑设计，另立。
- [`access-control/workspace-user-groups.md:97`](../../access-control/workspace-user-groups.md#L97) 未分配用户双栏点选：新页按空间成员邀请的方式输入用户名，不拉全量平台用户。

### app-store（8）

- [`app-store/detail.md:94`](../../app-store/detail.md#L94) **安装 values 的结构化表单（values.schema.json 驱动的表单视图）**：老 console 在 chart 带 `values.schema.json` 时提供「表单 / YAML」切换。
- [`app-store/detail.md:100`](../../app-store/detail.md#L100) **审核/上架/编辑应用**：商店管理页的职责，不在详情。
- [`app-store/detail.md:102`](../../app-store/detail.md#L102) **工作空间级安装**：openpitrix 没有 workspace 级创建路由，安装目标必须是项目；弹窗因此包含项目选择。
- [`app-store/detail.md:103`](../../app-store/detail.md#L103) **卸载/升级入口**：本任务只创建 release；卸载是测试的清理手段，不是页面功能。
- [`app-store/installed-apps.md:91`](../../app-store/installed-apps.md#L91) **项目作用域的「应用」页**（老 console `/projects/<ns>/applications/template` 的列表与创建向导）：本页以企业空间汇总承接回读任务；项目级页面属于项目作用域，未在本单元交付。
- [`app-store/installed-apps.md:92`](../../app-store/installed-apps.md#L92) **升级 / 回滚**：openpitrix 没有 release 升级路由（`POST …/applications/<id>` 无对应 handler，实测 app 级 action 返回 `500 action not support`），页面如实说明，不提供控件。
- [`app-store/project-apps.md:82`](../../app-store/project-apps.md#L82) **应用「编辑信息」**：旧 console 的 `openpitrix.app.edit` 在升级/改名上有独立的接口语义，本部署的 release 升级无接口（已登记在 `installed-apps.md` 的明确不做）；改名未验证，不交付控件。
- [`app-store/workspace-apps.md:91`](../../app-store/workspace-apps.md#L91) **版本 YAML 编辑与 Chart 文件预览**：老 console 的版本行展开有 Chart 文件与 Readme 编辑；本单元不在模板详情内提供（商店详情已提供 README 只读预览）。

### app-workloads（23）

- [`app-workloads/_index.md:108`](../../app-workloads/_index.md#L108) 服务与路由创建已由 [network-create.md](./network-create.md) 承接；原先因缺专属表单列为不做的决定已撤销。路由规则编辑沿用已有入口。
- [`app-workloads/container-detail.md:79`](../../app-workloads/container-detail.md#L79) 容器编辑：容器由所属工作负载的模板定义，改模板才是唯一入口。
- [`app-workloads/detail-monitor.md:78`](../../app-workloads/detail-monitor.md#L78) 告警规则、导出、图表缩放：需要图表库或另一套模块。
- [`app-workloads/detail.md:60`](../../app-workloads/detail.md#L60) 不在详情做扩缩容（表单能力未迁移，记在待办）。
- [`app-workloads/edit-form.md:80`](../../app-workloads/edit-form.md#L80) 不给任务（Job）提供该入口：`spec.template` 创建后不可变，保存必然被 API 拒绝。
- [`app-workloads/edit-settings.md:82`](../../app-workloads/edit-settings.md#L82) 不给容器组做与创建相同的编辑表单。
- [`app-workloads/edit-settings.md:83`](../../app-workloads/edit-settings.md#L83) 不在任务编辑里提供节点选择、容器或存储。
- [`app-workloads/edit-settings.md:84`](../../app-workloads/edit-settings.md#L84) 不把名称、别名、描述或副本数扩缩容搬进「编辑设置」。
- [`app-workloads/empty-state-exit.md:71`](../../app-workloads/empty-state-exit.md#L71) 不做「重置所有列表条件」的全局动作（分页/排序不属于空态出口）。
- [`app-workloads/gray-release.md:127`](../../app-workloads/gray-release.md#L127) **不迁移发布任务的监控曲线**：老 console 卡片与详情里的请求量（RPS）、成功率（%）、延迟（ms）、TCP 收发（B/s）图表需要 servicemesh 工作负载指标。本环境 `/kapis/servicemesh.kubesphere.io/v1alpha2/.../workloads/<name>/
- [`app-workloads/gray-release.md:128`](../../app-workloads/gray-release.md#L128) **不代建新版本工作负载**：老 console 创建时会同时 POST 一个新版本的 Deployment 并在弹窗里编辑容器、副本数。新 UI 的创建向导选择**已存在**的 Deployment 作为发布目标；版本对应的工作负载由工作负载页维护，详情页提供到工作负载详情的链接（等价承接老 console 卡片到工
- [`app-workloads/gray-release.md:131`](../../app-workloads/gray-release.md#L131) **不级联删除版本工作负载**：删除只删 Strategy。理由见设计决策；老 console 在接管/镜像场景会删掉自己创建的版本工作负载，新 UI 无法区分「它创建的」与「用户自己的」，误删用户的 Deployment 风险更高。
- [`app-workloads/gray-release.md:132`](../../app-workloads/gray-release.md#L132) **不做流量比例历史/回滚**：没有历史记录接口。
- [`app-workloads/job-create.md:47`](../../app-workloads/job-create.md#L47) 不替代任务日志、执行状态及历史记录；不提供修改已创建 Job 的 Pod 模板。
- [`app-workloads/network-create.md:53`](../../app-workloads/network-create.md#L53) 不创建 Ingress 控制器或配置公网 DNS；不承诺创建后已能从集群外访问。
- [`app-workloads/network-create.md:54`](../../app-workloads/network-create.md#L54) 不把多端口或多规则限定为单条：完整配置通过 YAML 支持。
- [`app-workloads/resource-create.md:81`](../../app-workloads/resource-create.md#L81) 不做服务类型的 LoadBalancer 与外部流量策略表单；需要时走 YAML。
- [`app-workloads/resource-create.md:82`](../../app-workloads/resource-create.md#L82) 不做多端口列表表单（保留 YAML 模式）。
- [`app-workloads/resource-create.md:85`](../../app-workloads/resource-create.md#L85) 不给服务/应用路由详情页增加创建后编辑表单（已有编辑 YAML/端口/规则入口）。
- [`app-workloads/resource-create.md:86`](../../app-workloads/resource-create.md#L86) 不改动 Job/CronJob 与工作负载创建。
- [`app-workloads/s2ibuilder.md:121`](../../app-workloads/s2ibuilder.md#L121) **containerd 运行时警告**：旧创建表单在 runtime=containerd 时提示“容器运行时不支持此功能”；新 console 没有运行时信息来源，且该提示不阻止操作，故不做（不是能力删减，见 design GOT-05）。
- [`app-workloads/s2ibuilder.md:122`](../../app-workloads/s2ibuilder.md#L122) **通过 `/b2i_download` 反向代理下载制品**：旧 console 由自己的 server 提供该代理；新 BFF 只代理 `/api`、`/kapis`、`/apis`。改为解析 `spec.downloadURL` 路径、带 token 经 `/kapis` 取回 Blob 再下载（等价能力，见 d
- [`app-workloads/s2ibuilder.md:125`](../../app-workloads/s2ibuilder.md#L125) **批量编辑/批量运行**：旧 console 只有批量删除，新实现保持同一范围。

### cluster-management（68）

- [`cluster-management/_index.md:101`](../../cluster-management/_index.md#L101) 节点排空、项目创建/编辑/删除。
- [`cluster-management/_index.md:102`](../../cluster-management/_index.md#L102) 集群可见性与可插拔组件开关：需要平台侧写接口，当前迁移范围外（集群描述/别名/标签/供应商已可在列表与集群设置页编辑）。
- [`cluster-management/_index.md:105`](../../cluster-management/_index.md#L105) 集群网关与网关详情（老 console 有 5 个页签）：本集群网关控制器缺 Helm chart，Gateway 对象能创建到 `Deployed=True` 但 `spec` 被重写为空、Service 不创建，状态永远到不了就绪；项目作用域的网关页已交付，集群级不做。
- [`cluster-management/add-cluster.md:95`](../../cluster-management/add-cluster.md#L95) 用 KubeKey 新建集群（需要主机清单与 kubekey API）。
- [`cluster-management/add-cluster.md:97`](../../cluster-management/add-cluster.md#L97) 移除集群、更新 kubeconfig（老 console 有，另立功能点）。
- [`cluster-management/audit-search.md:61`](../../cluster-management/audit-search.md#L61) 审计导出：`/auditing/events/export` 实测 404。
- [`cluster-management/cluster-alerting-write.md:99`](../../cluster-management/cluster-alerting-write.md#L99) **内置策略的编辑 / 编辑 YAML / 删除**：内置策略由安装器维护；启停与 reset 之外的对象修改会在下一次协调时被覆盖，故不提供。
- [`cluster-management/cluster-alerting-write.md:100`](../../cluster-management/cluster-alerting-write.md#L100) **模板规则构建器**：老 console 的「模板规则 + 指标查询」构建器（按节点/工作负载/指标生成表达式）不迁移；项目级规则组此前已采用「直接编辑 PromQL」的模型，集群级复用同一模型，避免两个作用域出现两套规则语义。模板规则对象仍会原样展示其表达式与状态，可用 YAML 编辑。
- [`cluster-management/cluster-alerting-write.md:101`](../../cluster-management/cluster-alerting-write.md#L101) **策略创建向导的分步交互**：新 UI 用单个对话框（基本信息与规则同屏）代替老 console 的两步向导；字段覆盖名称/别名/检查间隔/描述与规则列表。
- [`cluster-management/cluster-alerting-write.md:102`](../../cluster-management/cluster-alerting-write.md#L102) **reset 恢复 metadata.labels**：reset 只写 `spec`；enable 标签保持当前值，不把安装时的 enable 值写回（避免静默重新启用已停用策略）。若将来需要连 enable 一起恢复，再单独加选项。
- [`cluster-management/cluster-alerting-write.md:103`](../../cluster-management/cluster-alerting-write.md#L103) **详情展示原始对象 / 审计字段 / YAML**：只渲染白名单摘要，不提供 YAML、事件或审计日志视图。
- [`cluster-management/cluster-alerting-write.md:104`](../../cluster-management/cluster-alerting-write.md#L104) **告警消息删除 / 静默 / 通知配置**：消息生命周期归告警控制器。
- [`cluster-management/cluster-alerting.md:74`](../../cluster-management/cluster-alerting.md#L74) **内置策略的编辑 / 删除**：编辑/删除仍属安装器。启用/停用与 reset 的契约见 write 文档（reset 基于 `alerting.kubesphere.io/initial-configuration` 注解）。
- [`cluster-management/cluster-alerting.md:75`](../../cluster-management/cluster-alerting.md#L75) **详情展示原始对象 / 审计字段**：详情只渲染白名单 labels 与 annotations；不提供 YAML、事件或审计日志视图。
- [`cluster-management/cluster-alerting.md:76`](../../cluster-management/cluster-alerting.md#L76) **告警消息删除 / 静默 / 通知配置**：消息生命周期归告警控制器，控制台删掉也会被重新评估出来。
- [`cluster-management/cluster-config.md:69`](../../cluster-management/cluster-config.md#L69) 集群级创建 / 编辑 / 删除 / 改角色：写操作回项目作用域，避免同一对象两个编辑入口。
- [`cluster-management/cluster-edit-info.md:51`](../../cluster-management/cluster-edit-info.md#L51) 修改集群名称、连接方式、kubeconfig（后者属「更新 kubeconfig」独立功能）。
- [`cluster-management/cluster-gateways.md:50`](../../cluster-management/cluster-gateways.md#L50) 本轮不安装集群网关控制器，不创建、编辑或删除集群网关：部署环境缺控制器 chart，无法验证真实就绪。
- [`cluster-management/cluster-gateways.md:51`](../../cluster-management/cluster-gateways.md#L51) 日志、监控和配置编辑仍是能力缺口，不能因本页可达而标记完成；项目写操作由既有项目网关页承接。
- [`cluster-management/cluster-list.md:84`](../../cluster-management/cluster-list.md#L84) 集群卡片视图：列表固定 10 条/页且为表格形态，卡片在同等信息量下占屏更大。host 与成员集群的区分用「角色」列与筛选完成，不单独分区展示（老 console 的分组卡片视图不迁移）。
- [`cluster-management/cluster-members.md:75`](../../cluster-management/cluster-members.md#L75) 通过直接编辑 ClusterRoleBinding 来授予角色（页面只经 `clustermembers` 聚合写入，避免绕过平台的角色模板校验）。
- [`cluster-management/cluster-pvc.md:69`](../../cluster-management/cluster-pvc.md#L69) 集群级创建 / 删除 / 扩容 / 编辑：写操作回项目作用域。
- [`cluster-management/cluster-pvc.md:71`](../../cluster-management/cluster-pvc.md#L71) 存储卷快照：集群级快照列表不在本功能点。
- [`cluster-management/cluster-switch.md:57`](../../cluster-management/cluster-switch.md#L57) 在切换器里添加/编辑集群（那是列表页的职责）。
- [`cluster-management/cluster-workloads.md:53`](../../cluster-management/cluster-workloads.md#L53) 在集群级页面直接创建：老 console 创建需先选项目，属另一交互，另立。
- [`cluster-management/component-detail.md:45`](../../cluster-management/component-detail.md#L45) 组件的启停/扩缩容：组件生命周期归 KubeSphere 安装器管理，控制台不提供写入口。
- [`cluster-management/component-detail.md:46`](../../cluster-management/component-detail.md#L46) 组件 YAML 编辑：同上。
- [`cluster-management/components.md:45`](../../cluster-management/components.md#L45) 组件重启、日志查看（属运维操作）。
- [`cluster-management/custom-resources.md:74`](../../cluster-management/custom-resources.md#L74) CRD 实例的 YAML 编辑（只读展示；编辑需要按动态资源路径做 schema 校验，另立功能点）。
- [`cluster-management/custom-resources.md:75`](../../cluster-management/custom-resources.md#L75) CRD 创建/编辑/删除（属安装器职责）。
- [`cluster-management/devops-projects.md:207`](../../cluster-management/devops-projects.md#L207) 运行停止 / 终止、Jenkins 队列操作、批量运行与批量删除：不在本轮；重放已实现。
- [`cluster-management/devops-projects.md:208`](../../cluster-management/devops-projects.md#L208) CD 创建 / 编辑信息 / 编辑 YAML / 同步 / 回滚 / 删除与 CD 明细页（Flux / Argo 子页）：不在本轮；本轮只读 CD 列表并编辑工程白名单。
- [`cluster-management/devops-projects.md:209`](../../cluster-management/devops-projects.md#L209) 代码仓库编辑 / 编辑 YAML / 内联新建仓库：本轮只做导入与删除。
- [`cluster-management/devops-projects.md:210`](../../cluster-management/devops-projects.md#L210) 工程角色 CRUD（新建 / 编辑信息 / 编辑权限 / 删除）与凭证详情活动页：不在本轮；角色只读。
- [`cluster-management/devops-projects.md:211`](../../cluster-management/devops-projects.md#L211) 成员批量移除、邀请时搜索用户、禁止操作自己的保护（旧 console 的 showAction）：不在本轮；测试只用唯一测试账号并自行清理。
- [`cluster-management/devops-projects.md:212`](../../cluster-management/devops-projects.md#L212) 工程用量、流水线统计、代码仓库选择器内的内联创建。
- [`cluster-management/devops-projects.md:213`](../../cluster-management/devops-projects.md#L213) 旧 console 列表的 4 秒自动刷新 / 运行中轮询：不在本轮，改为显式刷新与写后 invalidate；不在页面里做定时重拉。
- [`cluster-management/devops-projects.md:214`](../../cluster-management/devops-projects.md#L214) 按企业空间过滤 / 授权 DevOps 工程（本区域为 cluster scope）：见 design 的 DEC-01 重新考虑条件。
- [`cluster-management/edge-node-pages.md:47`](../../cluster-management/edge-node-pages.md#L47) 边缘节点接入/移除（`edgeruntime.kubesphere.io/v1alpha1/nodes/join` 属写操作，另立批次）。
- [`cluster-management/edge-node-pages.md:48`](../../cluster-management/edge-node-pages.md#L48) 设备/设备模板（老 console 的边缘节点详情未包含，属边缘运行时模块）。
- [`cluster-management/gateway-detail.md:71`](../../cluster-management/gateway-detail.md#L71) 安装/升级/删除集群网关与 ingress-nginx release（属安装流程，写操作）。
- [`cluster-management/gateway-detail.md:73`](../../cluster-management/gateway-detail.md#L73) 编辑 Ingress（回项目页）。
- [`cluster-management/gpu-resource.md:74`](../../cluster-management/gpu-resource.md#L74) 导出 CSV / 图片、拖拽缩放（会需要图表库，见技术方案的取舍）。
- [`cluster-management/gpu.md:84`](../../cluster-management/gpu.md#L84) 批量摘卡 / 批量重置：摘卡是 device plugin 的行为，控制台不提供会与调度器打架的按钮。
- [`cluster-management/gpu.md:87`](../../cluster-management/gpu.md#L87) 编辑卡属性、切换 vGPU 模式：模式切换属于「设置 vGPU 模式」页，不在本页。
- [`cluster-management/ip-pools.md:47`](../../cluster-management/ip-pools.md#L47) 创建/删除/编辑 IP 池。
- [`cluster-management/juicefs.md:73`](../../cluster-management/juicefs.md#L73) 修改卷配额（老 console 的 `PUT /volumes/{name}`，会创建一次性 job 并在失败时回滚 PV）：写操作，需要作业状态与回滚的可观测，另立。
- [`cluster-management/juicefs.md:75`](../../cluster-management/juicefs.md#L75) 卷的生命周期管理（创建/删除卷）、跨集群视图。
- [`cluster-management/log-collections.md:68`](../../cluster-management/log-collections.md#L68) 修改收集器/输入/输出：需要专门的编辑与校验流程。
- [`cluster-management/log-search.md:61`](../../cluster-management/log-search.md#L61) 日志导出（老 console 有下载，需要服务端导出接口，另立）。
- [`cluster-management/log-search.md:63`](../../cluster-management/log-search.md#L63) 导出：`/logs/export` 实测 404，没有可用接口。
- [`cluster-management/monitor-resource.md:78`](../../cluster-management/monitor-resource.md#L78) 不做按项目过滤、导出 CSV（列表页的过滤/导出能力不在本功能点范围）。
- [`cluster-management/namespace-detail.md:69`](../../cluster-management/namespace-detail.md#L69) 编辑配额 / LimitRange / 标签 / 状态：写路径在项目设置，且当前 webhook 故障。
- [`cluster-management/namespace-detail.md:71`](../../cluster-management/namespace-detail.md#L71) 用量趋势/监控图表：概览页与监控页已有，本页只显示 ResourceQuota 快照。
- [`cluster-management/network-policies.md:46`](../../cluster-management/network-policies.md#L46) 在本页创建/编辑/删除策略。
- [`cluster-management/nodes.md:103`](../../cluster-management/nodes.md#L103) 节点排空、导入/删除、批量污点；不在生产环境验证 GPU 模式切换。RDMA 端口和已上报拓扑此前缺少确认契约，本批确认 B200 只读接口后迁移；不探测未上报设备或推断连接。
- [`cluster-management/overview.md:116`](../../cluster-management/overview.md#L116) 集群设置（编辑描述、可见性、可插拔组件开关）：需平台侧写接口，当前迁移范围外。
- [`cluster-management/overview.md:118`](../../cluster-management/overview.md#L118) 不提供 kubeconfig 编辑或更新成员集群连接配置；只读用户配置与连接配置不是同一任务。原“不提供下载”判断已在 2026-11-15 复盘后反转。
- [`cluster-management/settings.md:78`](../../cluster-management/settings.md#L78) 集群可见性与分组标签编辑：安装器字段，改动会与安装配置产生分歧。
- [`cluster-management/settings.md:79`](../../cluster-management/settings.md#L79) region / zone 编辑：需要平台 regionZones 配置，当前环境没有。
- [`cluster-management/settings.md:80`](../../cluster-management/settings.md#L80) 删除集群、上下线集群：属平台侧编排，不在集群设置范围。
- [`cluster-management/storage-classes.md:61`](../../cluster-management/storage-classes.md#L61) 创建与编辑存储类型（属基础设施操作）。
- [`cluster-management/storage-classes.md:63`](../../cluster-management/storage-classes.md#L63) 在关联存储卷列表里删除或编辑存储卷：这里只是入口，操作回项目存储页。
- [`cluster-management/visibility.md:51`](../../cluster-management/visibility.md#L51) 企业空间授权列表与授权变更（需要联邦工作空间资源）。
- [`cluster-management/yaml-edit.md:58`](../../cluster-management/yaml-edit.md#L58) 不做多文档 YAML 与 CRD 实例的 YAML 编辑（后者在 parity 报告登记为有意不迁移）。
- [`cluster-management/yaml-edit.md:59`](../../cluster-management/yaml-edit.md#L59) 不在列表页新增「编辑 YAML」入口；只补详情页。
- [`cluster-management/yaml-edit.md:60`](../../cluster-management/yaml-edit.md#L60) 不给持久卷/存储类型补删除入口（理由见约束）。
- [`cluster-management/yaml-edit.md:61`](../../cluster-management/yaml-edit.md#L61) 不实现节点污点/标签的专用编辑器；这些字段通过编辑 YAML 修改。

### configmaps（6）

- [`configmaps/_index.md:76`](../../configmaps/_index.md#L76) 不显示 YAML 原文与编辑入口（属创建 / 编辑能力，首期不做）。
- [`configmaps/ai-surface.md:67`](../../configmaps/ai-surface.md#L67) 不做 MCP server：句柄是给任意自动化用的，绑定一种协议会限制复用。
- [`configmaps/create.md:74`](../../configmaps/create.md#L74) 不做标签（labels）输入——旧 console 的创建表单没有，需要时走 YAML。
- [`configmaps/create.md:75`](../../configmaps/create.md#L75) 不做多文档 YAML（`---` 分隔）。
- [`configmaps/create.md:76`](../../configmaps/create.md#L76) 不做从文件批量导入多个键值。
- [`configmaps/edit.md:77`](../../configmaps/edit.md#L77) 不做 labels 的图形化编辑（走 YAML）。

### integration（1）

- [`integration/_index.md:90`](../../integration/_index.md#L90) 不把新前端并入 ks-console 镜像（构建与重启会互相绑死，评估后否决）。

### monitoring（12）

- [`monitoring/_index.md:75`](../../monitoring/_index.md#L75) 集群级与内置告警策略的编辑（由安装器维护）。
- [`monitoring/_index.md:76`](../../monitoring/_index.md#L76) 告警消息的静默、屏蔽与通知配置。
- [`monitoring/alerts-write.md:77`](../../monitoring/alerts-write.md#L77) **集群级与全局级策略的创建、编辑**：探测确认 API 允许写（`POST /clusterrulegroups` 与 `POST /globalrulegroups` 在 `?dryRun=All` 下均返回 201，真实 `POST` + `DELETE` 也可用），但这些对象由安装器维护、没有项目归属，页面不提
- [`monitoring/alerts-write.md:79`](../../monitoring/alerts-write.md#L79) **编辑 YAML**：本功能点只做表单编辑；YAML 编辑作为独立能力另行登记。
- [`monitoring/alerts-write.md:82`](../../monitoring/alerts-write.md#L82) **改名**：名称创建后不可改。
- [`monitoring/alerts.md:62`](../../monitoring/alerts.md#L62) **告警消息删除**：聚合 API 不提供 item 删除路由（实测 `DELETE /kapis/alerting.kubesphere.io/v2beta1/…/alerts/<name>` 与 `…/globalalerts/<name>` 均返回 404 Page Not Found），旧 console 的项
- [`monitoring/custom-monitoring.md:59`](../../monitoring/custom-monitoring.md#L59) 面板编辑器与图表渲染：老 console 的 Grafana 式编辑器（拖拽、缩放、逐面板 PromQL）是独立组件套件，另立。
- [`monitoring/custom-monitoring.md:60`](../../monitoring/custom-monitoring.md#L60) 新建/删除仪表板：本轮页面只读列表 + YAML；写路径需要模板/配额联动，另立。
- [`monitoring/custom-monitoring.md:61`](../../monitoring/custom-monitoring.md#L61) 集群级仪表板：在集群管理 › 自定义监控（已迁移）。
- [`monitoring/rules.md:114`](../../monitoring/rules.md#L114) 内置与集群级规则组的编辑：由安装器维护，改了下一次协调会覆盖。
- [`monitoring/rules.md:116`](../../monitoring/rules.md#L116) 告警消息删除以外的批量操作；告警消息本身不提供删除（聚合 API 无 item DELETE 路由，见 `alerts.md`）。
- [`monitoring/rules.md:118`](../../monitoring/rules.md#L118) 逐策略通知渠道：老 console 告警策略页族的表单没有该字段（通知在平台「通知管理」的独立对象中），规则组 CRD 的 `spec` 只有 `interval` / `partial_response_strategy` / `rules`（2026-11-15 实测 schema），本页不提供。

### platform-settings（4）

- [`platform-settings/_index.md:68`](../../platform-settings/_index.md#L68) 编辑平台信息与通知渠道（渠道凭据是可读性受限的 Secret）。
- [`platform-settings/channels.md:50`](../../platform-settings/channels.md#L50) 通知条件（alertSelector）与告警规则绑定。
- [`platform-settings/feishu.md:58`](../../platform-settings/feishu.md#L58) 飞书应用与机器人的创建、审核（在飞书侧完成）。
- [`platform-settings/feishu.md:59`](../../platform-settings/feishu.md#L59) 通知条件（`alertSelector`）与消息模板（`template/tmplText/tmplType`）。

### project-settings（14）

- [`project-settings/_index.md:80`](../../project-settings/_index.md#L80) 网关真正就绪的验证：需要安装网关控制器 Helm chart（对象可创建、状态可上报，Service 不会创建）。
- [`project-settings/_index.md:81`](../../project-settings/_index.md#L81) 项目删除：属危险操作，需单独的确认流程。
- [`project-settings/base-info.md:52`](../../project-settings/base-info.md#L52) 编辑项目信息（需要平台侧表单）。
- [`project-settings/gateway.md:71`](../../project-settings/gateway.md#L71) 集群网关（宿主网关）的创建/编辑/删除：仍由集群管理员安装流程与网关详情页负责，本单元只做项目网关的行编辑/删除；批量删除与旧版网关升级入口本轮不做（当前集群没有可升级对象）。
- [`project-settings/members.md:77`](../../project-settings/members.md#L77) 不删除平台用户，不编辑角色权限规则，不管理租户(企业空间)成员绑定。
- [`project-settings/members.md:78`](../../project-settings/members.md#L78) 邀请不改成旧页的用户搜索弹窗（继续输入用户名）。
- [`project-settings/network-isolation.md:68`](../../project-settings/network-isolation.md#L68) 策略的**编辑**（创建与删除已迁移；修改仍用 YAML）。
- [`project-settings/network-isolation.md:69`](../../project-settings/network-isolation.md#L69) 策略的**编辑**（含多规则与 `ipBlock` 的写入）：规则视图只读展示这些规则，编辑仍用 YAML。
- [`project-settings/network-isolation.md:71`](../../project-settings/network-isolation.md#L71) 老的「内部白名单 / 外部白名单」聚合视图：老实现把 `NetworkPolicy` 重新抽象成「项目→项目」「IP 段 + 端口」两栏，读的时候反而看不到对象本身；本控制台直接展示 `NetworkPolicy` 对象与其规则，语义与 kubectl 一致。按项目间白名单的**新建向导**另立功能点（见缺口分析 R-
- [`project-settings/overview.md:55`](../../project-settings/overview.md#L55) 配额编辑：已有项目设置的配额编辑入口。
- [`project-settings/overview.md:56`](../../project-settings/overview.md#L56) 概览页的「如何邀请成员 / 如何设置网关」提示卡片：这类引导卡只在首次使用时有价值，之后长期占据首屏；对应能力在成员页与网关页都有入口，概览页不再重复。
- [`project-settings/role-detail.md:64`](../../project-settings/role-detail.md#L64) 编辑/删除角色、编辑规则：需要 RBAC 编辑器，且当前写类 webhook 故障。
- [`project-settings/role-detail.md:65`](../../project-settings/role-detail.md#L65) 增删 RoleBinding、修改成员：成员页与角色权限对话框各有入口，本页只读。
- [`project-settings/roles.md:54`](../../project-settings/roles.md#L54) 角色的**创建**（需要规则编辑器）。

### secrets（10）

- [`secrets/_index.md:79`](../../secrets/_index.md#L79) 不做 `kubernetes.io/ssh-auth`、`kubernetes.io/dockercfg` 等其余类型的专用表单；用 YAML 编辑。
- [`secrets/create.md:76`](../../secrets/create.md#L76) 不做 labels 输入（走 YAML）。
- [`secrets/create.md:77`](../../secrets/create.md#L77) 不做从文件导入证书或 `.dockerconfigjson`（可粘贴内容）。
- [`secrets/create.md:78`](../../secrets/create.md#L78) 不做多条目镜像仓库的图形编辑（编辑器只维护一个 registry，其余走 YAML）。
- [`secrets/create.md:79`](../../secrets/create.md#L79) 不做服务账户令牌类型的手动创建。
- [`secrets/delete.md:65`](../../secrets/delete.md#L65) 不做「删除前检查是否被引用」的告警。
- [`secrets/detail.md:70`](../../secrets/detail.md#L70) 不做值的就地编辑（走编辑设置）。
- [`secrets/detail.md:71`](../../secrets/detail.md#L71) 不做 labels/annotations 展示（走编辑 YAML）。
- [`secrets/edit.md:80`](../../secrets/edit.md#L80) 不做类型的修改（走 YAML）。
- [`secrets/edit.md:82`](../../secrets/edit.md#L82) 不做「编辑信息」中的标签（labels）编辑。

### serviceaccounts（7）

- [`serviceaccounts/_index.md:82`](../../serviceaccounts/_index.md#L82) 不编辑 `secrets[]` 与 `imagePullSecrets`（走 YAML）。
- [`serviceaccounts/_index.md:84`](../../serviceaccounts/_index.md#L84) 不做角色重新绑定（只改注解，不改 RoleBinding）。
- [`serviceaccounts/ai-surface.md:52`](../../serviceaccounts/ai-surface.md#L52) 不暴露「在集群中执行命令」的能力。
- [`serviceaccounts/create.md:63`](../../serviceaccounts/create.md#L63) 不做令牌自动创建（集群决定）。
- [`serviceaccounts/create.md:64`](../../serviceaccounts/create.md#L64) 不做 `imagePullSecrets` 选择（走 YAML）。
- [`serviceaccounts/detail.md:71`](../../serviceaccounts/detail.md#L71) 不做 kubeconfig 的就地编辑。
- [`serviceaccounts/edit.md:56`](../../serviceaccounts/edit.md#L56) 不在「编辑」里改角色（见 `role`）。

### storage（15）

- [`storage/_index.md:61`](../../storage/_index.md#L61) 快照创建（需要 VolumeSnapshot CRD，本集群未安装）。
- [`storage/clone.md:46`](../../storage/clone.md#L46) 克隆快照（从快照创建新卷已由创建流程覆盖）。
- [`storage/clone.md:47`](../../storage/clone.md#L47) 跨项目克隆：dataSource 只能是同命名空间的对象。
- [`storage/create-snapshot.md:48`](../../storage/create-snapshot.md#L48) 删除快照：属快照列表/详情的删除操作。
- [`storage/create.md:51`](../../storage/create.md#L51) 就地扩容：属详情的「扩容」操作，已单独迁移。
- [`storage/create.md:52`](../../storage/create.md#L52) 选择具体持久卷（PV 预绑定）：老 console 的新建表单不提供，属高级 YAML 场景。
- [`storage/create.md:53`](../../storage/create.md#L53) 从其他项目的快照恢复：快照是命名空间资源，跨项目恢复不在本页。
- [`storage/detail-snapshots.md:68`](../../storage/detail-snapshots.md#L68) 创建 / 删除快照（写操作，属快照管理；B200 当前写类 webhook 故障也使这些操作不可用）。
- [`storage/detail-snapshots.md:69`](../../storage/detail-snapshots.md#L69) 快照内容的嵌套查看（由快照内容页面负责）。
- [`storage/detail-tabs.md:47`](../../storage/detail-tabs.md#L47) 元数据就地编辑（走编辑信息/编辑 YAML）。
- [`storage/list.md:57`](../../storage/list.md#L57) 扩容已迁移，但仅对存储类声明了 `allowVolumeExpansion` 的卷开放。
- [`storage/snapshot-content.md:50`](../../storage/snapshot-content.md#L50) 编辑或删除快照内容：由 CSI 控制器管理，控制台写入会绕过它的状态机。
- [`storage/snapshot-content.md:51`](../../storage/snapshot-content.md#L51) 从快照恢复：需要 PVC 创建流程与数据源选择，属另一功能。
- [`storage/snapshots.md:75`](../../storage/snapshots.md#L75) 不做 VolumeSnapshotContent（快照内容）独立视图：老 console 用它对账底层内容，但本轮两个列表已能回答运维问题；它对 agent 与人工都属于深链场景，登记为后续改进。
- [`storage/snapshots.md:77`](../../storage/snapshots.md#L77) 不做快照的创建 / 恢复 / 删除，也不做快照类型的创建：这些是写操作，写路径尚未在此区域迁移。

### user-settings（7）

- [`user-settings/_index.md:103`](../../user-settings/_index.md#L103) **头像上传**：需要对象存储与图片处理，User 对象里没有承载头像的字段，平台也没有该接口。