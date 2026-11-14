# 新 UI 相对老 console 的缺口分析

> **这份文档回答一个问题：新 UI 比老 console 少了什么。**
> 不是迁移计划，不是新 UI 的总结，是一份可以逐条复核的缺口清单。
>
> 事实源：**老 console 源码**（`console/src`，KubeSphere 3.1 fork）与**新 UI 源码**（`console/kube-frontend/apps/console-next`）。
> 每一条结论都能追到 `路径:行号`。没读到的写「未核实」，不猜。
> 判定口径遵循 `console/docs/legacy-ui-migration-guide.md` §2.1（以源码为准，不以截图为准）与 §3（照搬 / 改进 / 不迁移）。
>
> 生成时间：2026-11-14。分析基线 commit `abea36211`，交付时仓库已推进到 `d820ffcfa`（分析期间有并发提交，见 §9.1）。

---

## 0. 摘要

### 0.1 一句话

**新 UI 不是"少了几页"，而是少了四层东西：整块的作用域（企业空间 / DevOps / 联邦项目 / 应用商店）、成体系的集群级资源页、所有需要流式通道的能力（终端 / 日志）、以及详情页的页签体系。**

### 0.2 规模对照

| 维度 | 老 console | 新 UI | 差 |
| --- | --- | --- | --- |
| 路由条目（脚本抽取，剔除重定向与 `*` 兜底） | **200** | **65 个页面** | — |
| 其中列表页 | 125 | 45 | −80 |
| 其中详情页 | 75 | 20 | −55 |
| 作用域 | 9 个（全局 / 平台 / 企业空间 / DevOps / 联邦项目 / 应用商店 / 集群 / 集群下项目 / 项目） | 4 个（全局 / 平台 / 集群 / 项目） | **−5** |

> 口径：老 console 的路由取自 `console/src/pages/*/routes/*.js`（脚本见 §9.2）；另有两处由 `getChildRoutes` 动态生成的子页签（企业空间 overview 3 个、灰度发布 2 个）与 `/terminal/*` 独立窗口未计入这 200，实际约 207 条。
> 新 UI 的路由即 `apps/console-next/src/routes/` 的目录结构：项目 22 列表 + 13 详情、集群 13 + 4、平台 3 + 3、平台设置 3、顶层 4。

### 0.3 缺口总量

| 层 | 数量 | 说明 |
| --- | --- | --- |
| **页面级缺口** | **115 个真缺失** + 22 个「有替代但不等价」 | 见 §3 |
| **功能级缺口** | **50 项能力点**（按能力去重） | 见 §4；按「页面 × 功能」展开为 212 条，明细见 §11 的四份证据文件 |
| **疑似回归** | **31 条** | 老 console 有、新 UI 漏了、且 `page-parity-report.md` 与 `design/` 都没有登记理由，见 §5 |
| **架构级缺失** | **4 项** | 终端 / kubectl / 节点 shell / 日志 tail，全部卡在「新 UI 没有流式通道」，见 §4.1 |
| **顶栏死链** | **2 个** | `/kube-frontend/apps`、`/kube-frontend/apps-manage` 有入口无路由，见 §4.7 |
| **文档漂移** | **3 处** | parity 报告与 `area-migration-plan.md` 落后于代码或与代码矛盾，见 §6 |

### 0.4 最要紧的 8 条

1. **四个整块作用域不存在**：企业空间（18 路由）、DevOps 工程（11 页）、联邦项目（22 页）、应用商店（7 页）。新 UI 一个路由都没有。
2. **集群级应用负载 8 页 + 集群级配置 3 页 + 集群级网络 2 页，全缺**，且 `areas/registry.ts` 里连 `status: 'planned'` 的占位都没登记，`page-parity-report.md` 全篇未提。
3. **容器 exec / kubectl / 节点 shell / 容器日志 tail 四个通道级能力整体不存在**：老 console 走 `ws://`（`console/src/components/Terminal/index.jsx:35-39`），新 UI 的 `packages/api-client/src` 无 exec/logs/stream 端点、`server/src/proxy.ts` 无 WebSocket `upgrade`。
4. **详情页的页签体系整体丢失**：老工作负载详情是「左栏 + 6 页签」（监控 / 环境变量 / 事件 / 元数据 / 资源状态 / 版本记录），新 UI 是单页纵向分区，全部工作负载（含 Pod）共用 `WorkloadDetailPage.tsx` 一个组件。
5. **独立的容器详情页整页缺失**：`pods/:podName/containers/:containerName` 在老 console 是一级页面（12 项属性 + 4 页签 + 终端按钮），新 UI 的 Pod 详情里容器只列镜像字符串、不可点。
6. **编辑能力退化**：可编辑 YAML 的资源 **21 类 → 13 类**，定制编辑设置 **21 种 → 9 种**（Deployment 只剩「副本数」，改镜像必须编辑整份 YAML）。
7. **顶栏两个死链**：`shell/AppShell.tsx:239,248` 的「应用商店管理」「应用商店」指向不存在的路由；同时新 UI **没有兜底 404 路由**，点下去是空白。
8. **部分创建能力缺失**：Service / Ingress / PVC / 快照 / StorageClass / 项目（命名空间）/ 节点 / 网关 都无法在新 UI 创建。

---

## 1. 判定口径

| 状态 | 含义 | 处理 |
| --- | --- | --- |
| **真缺失** | 老 console 有、新 UI 没有任何路由或替代路径 | 计入缺口，给补齐建议 |
| **有替代（不等价）** | 新 UI 用另一个页面/弹窗承接了同一件事，但能力变窄 | 计入缺口，写明差在哪 |
| **已迁移** | 有对应页面且功能基本对齐 | 不重复报，但功能级差异仍单列 |
| **有意不迁移** | `page-parity-report.md` 或 `console/design/` 已登记理由 | 不算缺口，只在附录标注出处 |
| **疑似回归** | 老 console 有、新 UI 漏了、且两处都查不到理由 | 单列 §5，需人工判定「补」还是「登记」 |

**三条纪律**（来自迁移指南）：

1. **以源码为准**。老 console 有懒加载与双渲染，截图和 DOM 会对不上；页面功能一律读 `containers/**` 的实现，不看路由名推断。
2. **区分「没做」和「决定不做」**。已登记的理由（如 openpitrix / devops / servicemesh 模块关闭）不重复当缺陷报；但**没登记的**必须浮出来。
3. **子页面也要对照**。只比列表页会把创建/编辑/详情/删除的差异留到用户那里。

---

## 2. 作用域地图：缺的是哪一层

```text
老 console                                   新 UI
────────────────────────────────────────    ────────────────────────────────────────
/                    工作台/日志/事件/审计/账单  →  /kube-frontend         （只有入口卡片）
                      /support /404 /terminal
/clusters            集群列表                 →  /kube-frontend/clusters   ✓
/access              users / roles / workspaces →  /kube-frontend/access     ✓
/settings            base-info / third-login  →  /kube-frontend/settings   （info + mail 在迁）
                     + 6 个通知渠道
/workspaces/:ws      企业空间控制台 18 路由     →  ✗ 不存在
/:ws/clusters/:c/devops/:d   DevOps 11 页     →  ✗ 不存在
/:ws/federatedprojects/:ns   联邦项目 22 页    →  ✗ 不存在
/apps /apps-manage   应用商店 7 页             →  ✗ 不存在（顶栏有死链）
/clusters/:c         集群 54 路由              →  /kube-frontend/clusters/:c  13 页
/:ws/clusters/:c/projects/:ns  项目 36 路由    →  .../projects/:ns            35 页
```

**读法**：右上角有 ✓ 的两个作用域是「基本对得上」；中间四行 ✗ 是**整层空白**；下面两行是「页面在，但深度不够」。

---

## 3. 页面级缺口

### 3.1 按作用域汇总

| 作用域 | 老路由/页 | 已迁移 | 有替代（不等价） | 真缺失 | 有意不迁移 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| 全局 + 平台（工作台/访问控制/平台设置/企业空间/DevOps/联邦项目/应用商店） | 82 | 2 | 7 | **73** | 0 | §11 · 10-platform |
| 集群 `/clusters/:cluster` | 54 | 10 | 7 | **35** | 2 | §11 · 20-cluster |
| 项目 `/projects/:namespace` | 36 | 17 | 8 | **7** | 4 | §11 · 30-project |
| 跨页面能力（终端/日志/检索/404 等页面级） | 9 | 0 | 0 | **9** | 0 | §11 · 40-cross-cutting |
| **合计** | **181** | **29** | **22** | **124** | **6** | — |

> 各作用域的计数基数是各自枚举出的「页面 + 详情 + 页签组」，互有 1~2 条重叠（如集群下的项目详情既算集群入口也算项目页）。去重后的**页面级真缺失为 115 个**。

### 3.2 全局与平台作用域（73 个真缺失）

**四个整块空白**：

| 块 | 页数 | 老路由 | 新 UI |
| --- | --- | --- | --- |
| 企业空间控制台 | 18 | `/workspaces/:ws/*` | 无。新 UI 只有平台侧只读的 `access/workspaces/$name`（`pages/platform/WorkspaceDetailPage.tsx`），没有配额、角色、部门、DevOps、应用仓库，也没有任何写操作 |
| DevOps 工程 | 11 | `/:ws/clusters/:c/devops/:d/*` | 无。含图形化流水线编辑器（`components/Pipeline/StepsEditor`）与运行日志 |
| 联邦项目 | 22 | `/:ws/federatedprojects/:ns/*` | 无。联邦版每个详情页都有跨集群副本状态（`components/ClusterWorkloadStatus`），不是项目级代码换个 namespace |
| 应用商店 | 7 | `/apps`、`/apps-manage/*` | 无。依赖 openpitrix（`server/config.yaml:146`） |

**单页缺失**：

| 页面 | 老路由 | 说明 |
| --- | --- | --- |
| 日志查询 | `/logquery` | 三步向导：选集群 → 输条件 → 看详情（`components/Modals/LogSearch/index.jsx:97-119`） |
| 事件检索 | `/eventsearch` | 依赖 `events` 模块 |
| 审计检索 | `/auditingsearch` | 依赖 `auditing` 模块 |
| 计量账单 | `/bill` | 依赖 `metering` 模块 |
| 支持 | `/support` | 文档 / 论坛 / Issue / Slack 四个入口 + 工单 |
| 第三方登录 | `/settings/third-login` | OAuth / GitHub OAuth / LDAP |
| 通知渠道 ×5 | `/settings/{feishu,dingtalk,wecom,slack,webhook}` | **正在并发迁移中**：交付时工作树里 `mail/dingtalk/wecom/slack/webhook` 五个路由已出现（未提交），**飞书仍缺** |
| 容器终端窗口 | `/terminal/...` | 独立新窗口，三种模式 |
| 404 | `/404` | 新 UI `src/routes/` 下无 `$.tsx`/`404` |

**有替代但不等价（7）**：工作台（`/dashboard` → `WorkbenchPage`，老的资源统计/最近访问/管理员面板全无）、集群列表（无 host/成员分组、无卡片视图）、用户列表/详情、平台角色列表/详情、企业空间列表。

### 3.3 集群作用域（35 个真缺失）

老 console 集群作用域 **54 条路由 / 37 个导航叶子项** → 新 UI **13 页**（`areas/registry.ts:186-209`）。

**成体系的三块，一页都没有**：

| 块 | 页数 | 老实现与项目级的实质差异 |
| --- | --- | --- |
| 集群级应用负载 | 8（deployments / statefulsets / daemonsets / jobs / cronjobs / pods / services / ingresses） | 有 **PROJECT 列**（单元格链到项目）、`ProjectSelect` 全命名空间筛选、**集群角色**权限口径（`components/HOCs/withList.js:82-89`）、创建时先选项目、联邦托管对象不可改（`show: !record.isFedManaged`） |
| 集群级配置 | 3（secrets / configmaps / serviceaccounts） | 同上，另有键数量列、角色列、令牌 Secret 列 |
| 集群级网络 | 2 + 1 详情（networkpolicies / ippools / ippools/:name） | 有 PROJECT 列；IP 池含「已用 IP/总量」与 Workspaces 页签 |

**其余单页缺失**：

GPU 卡列表 / GPU 卡详情 / GPU 资源监控（3 页签）、边缘节点列表 / 详情（依赖 `edgeruntime`）、系统组件详情（Pod 页签）、集群下的项目详情（4 页签 + 配额/LimitRange 编辑）、**集群级全命名空间 PVC 列表**、卷快照 / 快照类型 / 快照类型详情 / 快照内容 / `snapshots` 别名路由（6 页）、JuiceFS 共享存储（3 页签）、应用资源监控（2 页签）、集群级告警消息 / 告警策略 / 策略详情、集群网关设置 / 网关详情（5 页签）、Pod IP 池详情、日志收集器详情、集群角色列表 / 详情（集群作用域入口）。

> **两处容易被漏掉的**：
> - 老 `volumes` 的**默认页签是全命名空间 PVC 列表**，PV 只是第二个页签（`Storage/Volumes/routes.js:26-43`）。新 UI 只迁了 PV，**集群级 PVC 从未被任何文档提到**。
> - 老集群级告警比项目级多「自定义策略 / 内置策略」两个页签（`Alerting/Messages/index.jsx:70-92`，仅 `namespace` 为空时出现），parity 报告的 monitoring 一节只覆盖项目作用域。

### 3.4 项目作用域（7 个真缺失）

项目作用域是迁移得最完整的一块：老 36 条路由 → 新 35 页，**页面数量基本对得上**。缺的是深度（见 §4.2），整页缺失的只有 7 个：

| 页面 | 老路由 | 备注 |
| --- | --- | --- |
| **容器详情页** | `/pods/:podName/containers/:containerName` | 12 项属性 + 4 页签 + 终端按钮；新 UI 的 Pod 详情连容器入口都没有 |
| 应用（自制） | `/applications/composing` | CRD 应用，**不依赖 openpitrix** |
| 应用（自制）详情 | `/applications/composing/:name` | 老详情含组件 / 灰度 / 流量治理 / 链路追踪 4 个页签 |
| 网络策略详情 | `/networkpolicies/:name` | 出站/入站规则查看器（286 行） |
| 网关详情 | `/gateways/:gatewayName` | 复用集群网关详情组件 |
| 自定义监控 | `/custom-monitoring` | 仪表盘列表 + 增删改，**无模块门禁** |
| 404 兜底 | `routes/index.js:162` | — |

**有替代但不等价（8，其中 5 条实质不等价）**：`volumes` → `persistentvolumeclaims`（改名）、`volume-snapshots` → `volumesnapshots`、`alert-rules` → `alertingrules`、项目角色详情 → 弹窗、告警策略详情 → 弹窗、**网络隔离**（老「规则聚合视图 + 白名单增删」→ 新「NetworkPolicy 对象表」）、**网关**（老有集群网关区块 + 查看详情 → 新只读卡片）、日志收集（近似等价）。

---

## 4. 功能级缺口（按能力维度，去重后 50 项）

> 四份证据文件按「页面 × 功能」展开共 212 条；本节按**能力点**去重，每条后面的 `[10/20/30/40]` 表示证据出处（见 §11）。

### 4.1 架构级：流式通道（4 项，决定后面至少 10 项无法用「补页面」解决）

| # | 能力 | 老 console | 新 UI | 影响 |
| --- | --- | --- | --- | --- |
| F-01 | **容器 exec 终端**（含容器切换 + 状态/镜像/命令/资源面板） | `components/Terminal/index.jsx:35-39` 拼 `ws://`；`stores/terminal.js:66-87` 的 `kapis/terminal.kubesphere.io/v1alpha2/.../exec` | 无。全仓无 xterm/WebSocket 组件 | 排障时进不了容器——这是 KubeSphere 最高频的运维动作 |
| F-02 | **kubectl 交互式终端** | `stores/terminal.js:90-111` 先取 kubectl pod 再连 exec；`Modals/KubeCtl` 含使用说明面板 | 无 | 平台管理员失去图形界面里的 kubectl |
| F-03 | **节点 shell** | `stores/terminal.js:61-65` 的 `/nodes/{name}/exec` | 无 | 节点层排查只能出控制台 |
| F-04 | **容器日志实时 tail + 下载** | `components/Cards/ContainerLog/index.jsx:68-167`：ANSI 着色、每页 1000 行、实时开关、下载 `.log` | 无 | CrashLoopBackOff 时看不到任何日志 |

**根因**：`packages/api-client/src`（17 个文件）**没有任何 exec / logs / stream 端点**；`server/src/proxy.ts` **没有 `upgrade` 事件处理**，只有 HTTP 转发。补齐需要 BFF 支持 WebSocket + 前端终端组件，工作量与「补一个页面」不在一个量级。

**连带消失的还有老的全局工具箱**（`components/KubeTools`，右下可拖拽悬浮球，6 个工具 + 第三方工具）。其中 4 个工具的目标页面（日志查询 / 事件检索 / 审计检索 / 计量账单）在新 UI 里也不存在，见 §3.2。

### 4.2 详情页体系：页签 → 单页（6 项）

老 console 的详情页是统一结构：**左栏信息栏（名称/描述/标签/属性 + 更多操作）+ 右侧页签**（`core/containers/Base/Detail/index.jsx:143-189`）。新 UI 全部改为单页纵向分区，且**所有工作负载（含 Pod）共用 `pages/app-workloads/WorkloadDetailPage.tsx` 一个组件**。

| # | 能力 | 差距 | 证据 |
| --- | --- | --- | --- |
| F-05 | **工作负载详情页签** | 老 Deployment 6 页签（资源状态 / 版本记录 / 元数据 / 监控 / 环境变量 / 事件）→ 新单页。**监控、环境变量、事件、元数据 4 个页签全无**；Job 缺 3、CronJob 缺运行记录、Service 缺 3 页签 + 拓扑图、Ingress 缺 3 页签 | `Deployments/Detail/routes.js:30-59` vs `WorkloadDetailPage.tsx:85-459` `[30]` |
| F-06 | **容器详情页**（整页） | 12 项属性 + 资源状态（探针/生命周期/卷挂载卡片）+ 4 条监控曲线 + 环境变量 + 容器日志 + 终端按钮，全部无 | `Pods/Containers/Detail.jsx:35-231`、`routes.js:26-51` `[30]` |
| F-07 | **Pod 详情的调度信息 / 监控 / 环境变量 / 事件页签** | 全无；容器只列镜像字符串、不可点 | `Pods/Detail/routes.js:28-59` `[30]` |
| F-08 | **存储详情页签** | 存储卷 4 页签（资源状态含用量卡片 / 元数据 / 事件 / **快照**）全无；快照详情缺「数据来源 / 事件」 | `Volumes/Detail/routes.js:28-51` `[30]` |
| F-09 | **详情页 labels / annotations 展示** | 老左栏有 `renderLabels`；新详情页只有属性 `dl`，annotations 只能开 YAML 看 | `core/containers/Base/Detail/BaseInfo/index.jsx:90-105` `[30]` |
| F-10 | **详情页实时刷新** | 老用 websocket watch，对象 MODIFIED 时原地更新（`pages/projects/containers/Base/Detail/index.jsx:62-92`）；新 UI 只有 react-query 缓存 | 同上 `[30][40]` |

### 4.3 监控与图表（6 项）

| # | 能力 | 老 console | 新 UI |
| --- | --- | --- | --- |
| F-11 | **图表能力整体** | 自建 `components/Charts`：5 种 Area + 3 种 Bar + Pie + recharts，统一时间区间控制器 | 手写 4 张 SVG 折线（`ClusterMonitorPage.tsx:16-20` 有取舍注释，但未登记进 parity/design） |
| F-12 | **集群物理资源监控** | 14 类曲线（GPU 显存/利用率/分配、CPU、内存、load1/5/15、磁盘用量、inode、磁盘吞吐、IOPS、网络、Pod 状态、RDMA 6 类） | 4 条（CPU/内存/Pod/节点） |
| F-13 | **GPU 资源监控**（3 页签：总览/物理监控/排行） | `Monitor/Cluster/GPUResource/**` | 无 |
| F-14 | **应用资源监控**（2 页签：物理+虚拟+项目趋势 / 排行） | `Monitor/Resource/**` | 无（`node-usage` 只承担了老的节点排行） |
| F-15 | **组件专用监控**（etcd / apiserver / scheduler 三页） | `Monitor/Cluster/routes.js:42-60` | 无（已登记为有意不迁移） |
| F-16 | **服务拓扑图** | `components/Graph/**`（节点-边拓扑 + 策略表单） | 无（依赖 servicemesh 模块，但 parity 报告未写） |

### 4.4 编辑能力（5 项 + 矩阵）

| # | 能力 | 老 console | 新 UI | 差距 |
| --- | --- | --- | --- | --- |
| F-17 | **编辑 YAML** | **21 类资源** | **13 类** | 少 8 类：Node、PV、StorageClass、VolumeSnapshotClass、NetworkPolicy、CRD 实例、AlertingRule、IPPool |
| F-18 | **编辑设置（定制表单）** | **21 种**（容器模板、服务端口、路由规则、键值、污点标签、配额、权限规则…） | **9 种** | Deployment 只剩「副本数」（`ReplicasDialog`），**改镜像必须编辑整份 YAML** |
| F-19 | **编辑信息** | **23 类资源** | **18 类** | PV / NetworkPolicy / AlertingRule / Project / VolumeSnapshotClass / IPPool 从「有」变「无」 |
| F-20 | **YAML 变更 diff** | `components/DiffYaml` | 无 | 无差异对比 |
| F-21 | **详情页内联编辑** | `components/EditMode` + `EditForms` | 无 | 只能在弹窗里改 |

**高严重度的三处退化**：

- **Deployment / StatefulSet / DaemonSet 的「编辑设置」**：老 `workload.template.edit` 可改镜像、环境变量、资源限额、存储、亲和性、更新策略；新 UI 只有副本数。
- **Node 的污点 / 标签编辑**（含批量污点）：完全没有（已登记为有意不迁移）。
- **NetworkPolicy 的 YAML**：新 UI 能创建/删除，**但连"看/改 YAML"都没有**，改一条规则无路可走。

### 4.5 创建能力（7 项 + 矩阵）

老 console `components/Forms/` 下 29 个表单目录。对照结果：

| # | 资源 | 老 | 新 | 差距 |
| --- | --- | --- | --- | --- |
| — | ConfigMap / Secret / ServiceAccount / 5 类工作负载 / NetworkPolicy / Workspace / User / 项目角色 / AlertingRule / Cluster | 有 | 有 | 无 |
| F-22 | **Service / Ingress（应用路由）** | 有（含简易创建） | **无** | 能建 Deployment 但建不出对外入口；`IngressRulesDialog` 是编辑不是创建 |
| F-23 | **PVC / VolumeSnapshot / StorageClass** | 有 | **无** | 部分有意不迁移（parity:108、:45） |
| F-24 | **项目（命名空间）** | 有 | **无** | 有意不迁移（parity:43），新项目必须回老 console 或管理员建 |
| F-25 | **Node** | 有（`node.add`） | **无** | — |
| F-26 | **Gateway** | 有 | **无** | 有意不迁移（parity:122） |
| F-27 | **平台角色的规则** | 有 | **无** | `RoleEditorDialog.tsx` 只有 alias/description，建出来的角色没有权限 |
| F-28 | **通知渠道** | 6 种 | 5 种（交付时工作树） | 飞书仍缺；见 §9.1 |
| — | IPPool / 自定义监控 / 日志收集 / ImageBuilder / DevOps / 应用 / 联邦项目 | 有 | 无 | 页面本身缺失，见 §3 |

### 4.6 成员 / 角色 / 授权（6 项 + 矩阵）

| 作用域 | 老 console | 新 UI | 断层 |
| --- | --- | --- | --- |
| 平台 | 邀请/改角色/移除/**批量**/建角色/改规则/删角色/已授权用户页签 | 有创建/改角色/启停/删/权限规则查看；**无批量**、**无规则编辑器**、**无已授权用户页签**（`ClusterRoleDetailPage.tsx:13-19` 注释自述未迁） | 规则编辑与授权用户两处断 |
| 企业空间 | 成员 + 角色 + **用户组（部门树）** 全有 | **整层不存在** | 全断 |
| 集群 | 邀请/改角色/移除/批量移除 | **只读**（`ClusterMembersPage.tsx:17-18` 注释即声明） | 写操作全断 |
| 项目 | 全有 + 批量移除 | 邀请/改角色/移除/建角色/改规则/删角色 | 只缺批量移除 |
| DevOps | 全有 | 无作用域 | 全断 |

| # | 能力 | 差距 |
| --- | --- | --- |
| F-29 | **集群成员写操作**（邀请/改角色/移除） | 全无；已登记为有意不迁移（parity:33），但后果是「新集群加不了人」 |
| F-30 | **企业空间成员 / 角色 / 用户组** | 整层不存在；用户组（部门树 + 组内成员）在任何作用域都没有对应物 |
| F-31 | **成员批量移除** | 老 `member.remove.batch`；新只有单条 |
| F-32 | **用户登录历史** | 老有独立分页页签（`login-history`），新是固定 10 条的内联区块 |
| F-33 | **管理员重置他人密码** | 老 `Accounts/Detail/index.jsx:92-102`；新无入口 |
| F-34 | **用户批量启用/停用 + 预置账号保护面** | 老有 `selectActions` 三态批量与 `presetUsers` 全员保护；新只有逐行、只保护 `admin` |

### 4.7 顶栏与全局壳（6 项）

| # | 能力 | 老 console | 新 UI |
| --- | --- | --- | --- |
| F-35 | **帮助 / 文档入口** | 用户指南 + API 文档（`Layout/Header/index.jsx:110-122,192-196`） | 无 |
| F-36 | **「关于」（版本 / 许可）** | `Layout/LoginInfo/index.jsx:87-89,101-104` | 无 |
| F-37 | **兜底 404 页** | `/404` + `from: '*' → /404` | 无 |
| F-38 | **顶栏死链 ×2** | 老有 `enableAppStore` 开关控制显隐 | `AppShell.tsx:239` 的「应用商店管理」→ `/kube-frontend/apps-manage`、`:248` 的「应用商店」→ `/kube-frontend/apps`，**两个路由都不存在** |
| F-39 | **浮动工具箱（KubeTools）** | 6 个运维工具 + 第三方工具，可拖拽、位置持久化 | 无 |
| F-40 | **密码强度指示器** | `Modals/UserSetting/PasswordSetting/index.jsx:124-131`（`withStrength`） | 只有静态规则文案 |

> **反向核实（老 console 也没有，不计缺口）**：全局搜索、通知中心、快捷键。三者在老源码里都检索不到实现。
> **新 UI 反而更好的地方**：主题切换、侧栏折叠、移动端抽屉、语言切换（从用户设置弹窗移到顶栏，且不刷新页面）。

### 4.8 列表通用能力（6 项）

| # | 能力 | 老 console | 新 UI |
| --- | --- | --- | --- |
| F-41 | 每页档位 | 10/20/50/100 可切 | **固定 10**（12 个页面各自 `const PAGE_SIZE = 10`；`ResourceList` 支持 `pageSizeOptions` 但无页面使用） |
| F-42 | 列显隐 / 列宽 | `CustomColumns` + localStorage 持久化 | 无（`TableColumn` 只有 `hideOnMobile`，那是断点不是用户设置） |
| F-43 | 刷新按钮 | 工具栏常驻 | 无 |
| F-44 | 批量操作面 | 批量停止 / 批量移除成员 / 批量删除存储类与 PV 等 | **只有批量删除** |
| F-45 | 列表实时刷新 | WebSocket watch，ADDED/MODIFIED/DELETED 自动重取 | 无 |
| F-46 | 空态出口 | 「刷新数据 / 清除搜索条件」两个按钮 | 只有 title + description |

### 4.9 其他跨页面缺口（4 项）

| # | 能力 | 老 console | 新 UI |
| --- | --- | --- | --- |
| F-47 | **列表页头 Banner 说明与 tips** | 各列表页 `<Banner {...bannerProps} />`（模块说明 + 问号提示） | 只有 title + description |
| F-48 | **容器组列表的节点列 / Pod IP 列 / 状态筛选** | `Pods/index.jsx:106-157,120` | 无（列只有名称/状态/创建时间） |
| F-49 | **通知渠道的筛选条件** | `alertSelector.matchExpressions`（决定哪些告警走这个渠道，`Forms/Notification/BaseForm/index.jsx:157-181`） | 无；保存时 `receiverSpec` 只有 `{to, enabled}`，所有渠道对全部告警全量发送 |
| F-50 | **项目概览的资源用量图表** | `Overview/ResourceUsage/index.jsx:19-80`（11 项对象计数 + CPU/内存/GPU 曲线，12h 区间、30s 刷新） | 无 |

---

## 5. 疑似回归（31 条，未登记为有意不迁移）

> 判定：老 console 有、新 UI 漏了，且 `page-parity-report.md` 与 `console/design/` 里都查不到理由。
> 这些不是"已知取舍"，是需要人工判定的：要么补，要么补登记。

### 5.1 整块未登记（最严重，5 条）

| # | 项 | 老证据 | 为什么算回归 |
| --- | --- | --- | --- |
| R-01 | 集群级应用负载 8 页 | `clusters/routes/index.js:131-169`、`config.yaml:174-191` | parity 报告全篇没有一条提到集群级负载 |
| R-02 | 集群级配置 3 页 | `routes/index.js:171-184` | 同上 |
| R-03 | 集群级网络 2 页 + 详情 | `routes/index.js:256-264` | parity 只登记了项目设置下的网络隔离；且 `network`/`network.ippool` 模块**没有被登记为"不做"** |
| R-04 | 集群级告警消息 / 策略 / 策略详情 | `routes/index.js:218-225`、`detail.js:77-80` | parity 的 monitoring 一节只覆盖项目作用域 |
| R-05 | GPU 卡列表 / GPU 卡详情 / GPU 资源监控 3 页签 | `routes/index.js:111-114,210-213`、`detail.js:58-59` | parity 全篇没有 GPU 页面条目 |

### 5.2 页面级未登记（8 条）

| # | 项 | 老证据 | 新 UI |
| --- | --- | --- | --- |
| R-06 | 集群级全命名空间 PVC 列表 | `Storage/Volumes/Volume/index.jsx:152-249` | 无（集群作用域只有 PV） |
| R-07 | 快照三件套 6 页 + JuiceFS 共享存储 3 页签 | `VolumeSnapshots/routes.js`、`Storage/JuiceFS/index.jsx:56-82` | 无 |
| R-08 | 系统组件详情页（副本数 + Pod 列表） | `ServiceComponents/Detail/routes.js:25-33` | 无 |
| R-09 | 项目详情页 4 页签 + 配额/LimitRange 编辑 | `Projects/Detail/routes.js:28-49` | `namespaces/` 无 `$name.tsx` |
| R-10 | 集群网关设置 + 网关详情 5 页签 | `Gateway/index.jsx:53-68`、`Gateway/Detail/routes.js:27-58` | 无（parity 只在项目设置里登记了网关） |
| R-11 | 集群日志收集 3 类页签 + 收集器详情页 | `LogCollections/index.jsx:96-118` | 单页只读三段 |
| R-12 | 集群角色在集群作用域没有入口 | `routes/index.js:241-245`、`detail.js:73-75` | 只在平台 `access/clusterroles`，且**固定读 host 集群**（`PlatformListPage.tsx:44`） |
| R-13 | 容器 exec / kubectl / 节点 shell / 容器日志 tail | `components/Terminal/index.jsx:35-39` 等 | 无（parity 只登记了集群概览的 kubectl 快捷工具，**容器终端与节点 shell 一字未提**） |

### 5.3 已迁移页面内的未登记缺口（12 条）

| # | 项 | 老证据 | 为什么算回归 |
| --- | --- | --- | --- |
| R-14 | 节点列表 6 列 + 节点总览面板 + 列筛选 | `Nodes/index.jsx:332-373,426-457,514-769,892-973` | parity「节点列表」只登记了「节点排空、污点编辑、Pod 列表」，没登记 GPU/GPU 显存/Pod 用量/XPU/GPU 虚拟化模式/时间同步 6 列 |
| R-15 | 节点详情 5 页签 + 4 个操作 + 属性项 | `Nodes/Detail/routes.js:26-45`、`Detail/index.jsx:122-175` | 运行状态页签、编辑标签/污点操作没有登记 |
| R-16 | 存储类型详情的关联 PVC 列表 | `StorageClasses/Detail/routes.js:24-31` | parity「存储类型」只登记创建/编辑/设为默认 |
| R-17 | 平台角色详情的「已授权用户」页签 | `access/Roles/Detail/routes.js:33-38` | 代码注释自述了原因（`ClusterRoleDetailPage.tsx:16-19`），但没写进 parity 也没写进 design |
| R-18 | 平台角色的**规则编辑器** | `projects/Roles/index.jsx:59-71` + `actions/role.js:62` | parity:134 只登记「规则的多条编辑（当前一次一条）」，暗示存在单条编辑；实际 `RoleEditorDialog.tsx` 根本没有规则字段 |
| R-19 | 项目概览的资源用量图表 + 提示卡片 | `Overview/ResourceUsage/index.jsx:19-80`、`Overview/Help/index.jsx:19-53` | parity:126 只登记了「用量排行」和「应用列表」 |
| R-20 | 角色详情的「已授权用户」页签（项目级） | `projects/Roles/Detail/routes.js:32-36` | parity:127 只登记「规则的编辑」 |
| R-21 | 网络隔离的规则聚合视图与白名单增删 | `Network/Policies/RuleInfo/index.jsx:145-365` | parity:125 登记的是「策略的编辑」，把「规则视图」读成了「编辑」——范围误判 |
| R-22 | 存储卷详情的快照页签 | `Volumes/Detail/routes.js:46-49` | parity:108 登记的是「列表不做快照创建」，没登记详情页快照页签 |
| R-23 | 项目基本信息的角色/成员/服务统计 | `BaseInfo/index.jsx:196-215` | 未登记 |
| R-24 | 用户登录历史分页 / 管理员重置他人密码 / 批量启停 / 预置账号保护面 | `access/Accounts/index.jsx:36-41,102-152`、`Detail/index.jsx:92-102` | parity:135-136 只登记了「该用户在项目/企业空间里的角色」与「停用/启用与删除在行操作完成」 |
| R-25 | 集群列表 host/成员分组 + 卡片视图 | `Clusters/index.jsx:74-88,213-249` | parity:32 登记了注册/注销/上下线，没提分组与卡片视图 |

### 5.4 壳层与列表层未登记（6 条）

| # | 项 | 老证据 | 为什么算回归 |
| --- | --- | --- | --- |
| R-26 | 列表刷新按钮 | `components/Tables/Base/index.jsx:335-340` | 未登记；数据不自动刷新时用户没有手动出口 |
| R-27 | 列表实时刷新（WebSocket watch） | `workspaces/containers/Groups/index.jsx:84-105` | 未登记；列表永远是打开那一刻的快照 |
| R-28 | 空态的「刷新 / 清除筛选」出口 | `components/Tables/Base/index.jsx:365-399` | 未登记；空表时用户只能自己猜为什么空 |
| R-29 | 图表能力整体退化（14 类指标 → 4 条线） | `Monitor/Cluster/Monitor/PhysicalResource/index.jsx:32-302` | 代码注释有取舍说明，但**不在 parity 报告也不在 design/** |
| R-30 | 服务 / Ingress 无法创建 | `actions/service.js`、`actions/router.js`、`Forms/Service`、`Forms/Route` | parity 各资源页都没提「不能创建 Service/Ingress」 |
| R-31 | 密码强度指示器 | `Modals/UserSetting/PasswordSetting/index.jsx:124-131` | `design/kube-frontend/user-settings/` 的「明确不做」未提 |

> 另有一条**文档漂移**（不是代码缺口）：`area-migration-plan.md:134` 称节点详情含「容器组」页签，与代码和 parity 都矛盾——代码里没有，parity 登记为有意不迁移。见 §6。

---

## 6. 文档漂移：报告与代码不一致的地方

分析过程中发现 `page-parity-report.md` 与 `area-migration-plan.md` 有 3 处落后或矛盾。**引用这两份文档时需注意时效**。

| # | 位置 | 文档写的 | 代码实际 |
| --- | --- | --- | --- |
| D-01 | `page-parity-report.md:136-138` | 用户列表「编辑用户信息」、企业空间「编辑/删除」、平台角色「创建」都是「另立功能点」（= 未实现） | **都已实现**：`PlatformListPage.tsx:74-80` 的 primaryAction、`:217-256` 的 rowActions |
| D-02 | `page-parity-report.md:124` | 项目成员「邀请成员、修改角色、移出项目」列为有意未迁移 | **已实现**：`SettingsListPage.tsx:292-324`、`MemberDialog.tsx` |
| D-03 | `area-migration-plan.md:134` | 节点详情含「属性/标签/**容器组**」 | 代码没有 Pod 页签；parity:40 把它登记为有意不迁移 |

**成因**：`page-parity-report.md` 是从 PRD 的「明确不做」小节生成的（`prd/tools/build_prd.py`），而 PRD 没有随每一轮迭代同步更新「明确不做」。迁移指南 §9 已经指出过同类问题（门禁不检查编号重复）。

**建议**：把「明确不做」的条目与代码状态做一次对账，或者让 `parity_check.py` 增加一项「已登记未做 vs 代码里是否存在」的交叉检查。

---

## 7. 补齐优先级建议

排序依据：**用户在日常运维里做不到什么**，而不是「缺了几页」。

### P0 — 阻断日常运维（建议下一轮就做）

| 项 | 理由 | 工作量提示 |
| --- | --- | --- |
| 终端 / kubectl / 节点 shell / 日志 tail（F-01~F-04） | 四个通道级能力全无，排障基本不可用 | **大**：BFF 需支持 WebSocket upgrade + 前端终端组件 |
| 集群级应用负载 8 页 + 配置 3 页（R-01/R-02） | 管理员在集群视角看不到全命名空间的对象；`WorkloadListPage` 已支持 `namespace: ''` 与项目筛选，**页面本体可复用**，缺路由 + 侧栏登记 + PROJECT 列 + 集群级权限口径 | 中 |
| 修掉顶栏两个死链 + 补 404（F-37/F-38） | 成本极低、感知极强；违反 parity 报告自己定的「不做死按钮」原则 | 极小 |
| Pod / 容器详情页签（F-05/F-06/F-07） | 所有负载共用 `WorkloadDetailPage`，需要先决定「通用详情 + 按 kind 增补区块」的结构 | 中 |
| 编辑 YAML 覆盖度补齐（F-17） | NetworkPolicy / PV / StorageClass / Node 连 YAML 都没有，等于无法修改 | 小（`YamlDialog` 已通用） |

### P1 — 能力断层（下一到两轮）

集群级网络与告警（R-03/R-04）· 存储快照与 JuiceFS（R-06/R-07）· 节点列与节点详情（R-14/R-15）· 监控图表（F-11~F-16）· Service/Ingress/项目创建（R-30、§4.5）· 集群成员写操作与平台角色规则编辑器（§4.6）· 列表刷新与实时刷新（F-43/F-45）。

### P2 — 整层补齐与体验项

企业空间 / DevOps / 联邦项目 / 应用商店四个作用域（依赖模块与投入都大，需单独立项）· 通知渠道剩余 5 种 · 帮助/关于入口 · 列显隐与分页档位 · 密码强度指示器 · Banner tips。

### 一条流程建议

**先做「登记」再做「实现」**：把 §5 的 31 条逐条判定为「补」或「有意不迁移并写进 parity 报告 + design 文档」。当前最大的风险不是缺口本身，而是**缺口不可见**——115 个真缺失页面里有相当一部分既不在报告里、也不在 registry 的 `planned` 里，复核时会一直被当成"已完成"。

---

## 8. 附录 A：老页面 → 新 UI 路由全量映射

判定图例：**✓** 已迁移 ／ **⇄** 有替代（改名、合并或拆分，需核对等价性）／ **✗** 真缺失 ／ **⊘** 有意不迁移。

### A. 全局与平台入口（老 `src/pages/console/routes`、`src/core/routes.js`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/login` | `/login` | ✓ |  |
| `/login/confirm` | — | ✗ | 首次登录二次确认（如强制改密）；新 UI 无此环节 |
| `/password/confirm` | — | ✗ | 密码过期强制改密；新 UI 无 |
| `/dashboard` | `/kube-frontend` | ⇄ | 新工作台（WorkbenchPage）只有入口卡片；老仪表盘的资源统计与快捷入口未迁 |
| `/logquery` | — | ✗ | 日志检索页 |
| `/eventsearch` | — | ✗ | 事件检索页 |
| `/auditingsearch` | — | ✗ | 审计检索页 |
| `/bill` | — | ✗ | 账单页 |
| `/support` | — | ✗ | 支持页 |
| `/404` | — | ✗ | 新 UI 无兜底路由，未匹配路径没有 404 页 |
| `/clusters` | `/kube-frontend/clusters` | ✓ | 集群列表 |
| `/terminal/*` | — | ✗ | 容器终端 / kubectl / 节点终端（独立新窗口）整条链路缺失 |

### B. 平台访问控制（老 `/access`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/access/accounts` | `/kube-frontend/access/users` | ⇄ | 改名 accounts → users |
| `/access/accounts/:name` | `/kube-frontend/access/users/$name` | ✓ |  |
| `/access/roles` | `/kube-frontend/access/clusterroles` | ⇄ | 改名 roles → clusterroles |
| `/access/roles/:name` | `/kube-frontend/access/clusterroles/$name` | ✓ |  |
| `/access/workspaces` | `/kube-frontend/access/workspaces` | ✓ | 新 UI 另有 workspaces/$name 详情（老 console 无） |

### C. 平台设置（老 `/settings`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/settings/base-info` | `/kube-frontend/settings/info` | ⇄ | 工作树中正在迁移 |
| `/settings/third-login` | — | ✗ | 第三方登录（OAuth / LDAP / AD）配置 |
| `/settings/mail` | `/kube-frontend/settings/mail` | ⇄ | 工作树中正在迁移 |
| `/settings/feishu` | — | ✗ | 通知渠道 |
| `/settings/dingtalk` | — | ✗ | 通知渠道 |
| `/settings/wecom` | — | ✗ | 通知渠道 |
| `/settings/slack` | — | ✗ | 通知渠道 |
| `/settings/webhook` | — | ✗ | 通知渠道 |

### D. 应用商店（老 `/apps`、`/apps-manage`，依赖 openpitrix）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/apps` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps/:appId` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps/:appId/deploy` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/store` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/store/:appId` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/categories` | — | ⊘ | 依赖 openpitrix.appstore |
| `/apps-manage/reviews/:type` | — | ⊘ | 依赖 openpitrix.appstore |

### E. 企业空间（老 `/workspaces/:workspace`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `overview（页签 usage / ranking / clusters）` | — | ✗ | 整个企业空间作用域在新 UI 不存在 |
| `projects` | — | ✗ |  |
| `federatedprojects` | — | ✗ | 依赖多集群联邦 |
| `devops` | — | ⊘ | 依赖 devops 模块 |
| `apps / apps/:appId` | — | ⊘ | 依赖 openpitrix |
| `repos / repos/:repo_id` | — | ⊘ | 依赖 openpitrix |
| `base-info` | — | ✗ |  |
| `quota` | — | ✗ | 企业空间配额 |
| `roles / roles/:name` | — | ✗ |  |
| `members / members/:name` | — | ✗ | 新 UI 的 `access/workspaces/$name` 只做详情 + 成员列表，不是企业空间控制台 |
| `groups` | — | ✗ | 部门 / 用户组 |

### F. DevOps 工程（老 `/:ws/clusters/:cluster/devops/:devops`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `pipelines / pipelines/:name` | — | ⊘ | 依赖 devops 模块 |
| `cd / cd/:cd` | — | ⊘ | 依赖 devops 模块 |
| `code-repo` | — | ⊘ | 依赖 devops 模块 |
| `base-info` | — | ⊘ | 依赖 devops 模块 |
| `roles / roles/:name` | — | ⊘ | 依赖 devops 模块 |
| `members` | — | ⊘ | 依赖 devops 模块 |
| `credentials / credentials/:credential_id` | — | ⊘ | 依赖 devops 模块 |

### G. 联邦项目（老 `/:ws/federatedprojects/:ns`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `overview` | — | ✗ | 联邦项目作用域整体缺失 |
| `applications(+:name)` | — | ✗ |  |
| `deployments(+:name)` | — | ✗ |  |
| `statefulsets(+:name)` | — | ✗ |  |
| `services(+:name)` | — | ✗ |  |
| `ingresses(+:name)` | — | ✗ |  |
| `volumes(+:name)` | — | ✗ |  |
| `configmaps(+:name)` | — | ✗ |  |
| `secrets(+:name)` | — | ✗ |  |
| `base-info` | — | ✗ |  |
| `quota` | — | ✗ | 联邦项目配额 |
| `gateways(+:gatewayName)` | — | ✗ |  |
| `log-collections` | — | ✗ |  |

### H. 集群作用域（老 `/clusters/:cluster`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/overview` | `overview` | ✓ |  |
| `/nodes` | `nodes` | ✓ |  |
| `/nodes/:node` | `nodes/$name` | ✓ |  |
| `/nodes/:node/gpus/:gpuUuid` | — | ✗ | 单卡详情页 |
| `/edgenodes、/edgenodes/:node` | — | ⊘ | 依赖 edgeruntime 模块 |
| `/gpus` | — | ✗ | GPU 卡列表页（集群级） |
| `/components` | `components` | ✓ |  |
| `/components/:namespace/:name` | — | ✗ | 系统组件详情页 |
| `/projects` | `namespaces` | ⇄ | 改名 projects → namespaces |
| `/projects/:namespace（集群下的项目详情布局）` | — | ✗ | 老 console 可从集群入口直接进项目详情；新 UI 只能先切 workspace 再进项目 |
| `/customresources、/customresources/:name` | `custom-resources、custom-resources/$name` | ✓ |  |
| `/deployments` | — | ✗ | **集群级全命名空间**应用负载页 |
| `/statefulsets` | — | ✗ | 同上 |
| `/daemonsets` | — | ✗ | 同上 |
| `/jobs` | — | ✗ | 同上 |
| `/cronjobs` | — | ✗ | 同上 |
| `/pods` | — | ✗ | 同上 |
| `/services` | — | ✗ | 同上 |
| `/ingresses` | — | ✗ | 同上 |
| `/secrets` | — | ✗ | **集群级**配置 |
| `/configmaps` | — | ✗ | 同上 |
| `/serviceaccounts` | — | ✗ | 同上 |
| `/storageclasses、/storageclasses/:name` | `storageclasses、storageclasses/$name` | ✓ |  |
| `/volumes（PVC，集群级）` | — | ✗ | 集群级持久卷声明列表 |
| `/volume-snapshots` | — | ✗ | 集群级卷快照 |
| `/volume-snapshot-classes、/:name` | — | ✗ | 卷快照类 |
| `/volume-snapshot-content/:name` | — | ✗ | 快照内容详情 |
| `/snapshots/:namespace?` | — | ✗ | 快照页签入口 |
| `/pv/:name` | `persistentvolumes、persistentvolumes/$name` | ⇄ | 老 console 的 PV 详情挂在 `volumes` 页签里；新 UI 拆成独立页（老无 PV 列表路由） |
| `/juicefs-storage` | — | ✗ | 共享存储（JuiceFS 配额/性能/卷） |
| `/monitor-cluster` | `monitor` | ⇄ | 改名；需逐项核对图表与下钻 |
| `/gpu-resource` | — | ✗ | GPU 资源监控页 |
| `/monitor-resource` | — | ✗ | 应用资源监控页 |
| `/alerts` | — | ✗ | **集群级**告警消息 |
| `/alert-rules、/alert-rules/:name（含 builtin）` | — | ✗ | **集群级**告警策略与详情 |
| `/custom-monitoring` | — | ✗ | 自定义监控（需图表引擎） |
| `/base-info` | `settings` | ⇄ | 改名 base-info → settings；可写字段范围不同 |
| `/visibility` | `visibility` | ✓ |  |
| `/members` | `members` | ✓ |  |
| `/roles、/roles/:name` | — | ✗ | **集群级**角色（区别于平台角色 `access/clusterroles`） |
| `/networkpolicies` | — | ✗ | **集群级**网络策略 |
| `/ippools、/ippools/:name` | — | ✗ | 容器组 IP 池 |
| `/log-collections/:component、/:name` | `log-collections` | ⇄ | 老 console 按 logging / events / auditing 三类分页签并各有详情页；新 UI 单页只读展示四类对象 |
| `/gateways/:component、/:gatewayName` | — | ✗ | 集群网关 |
| `/kubeConfig` | — | ✗ | 集群 kubeconfig 管理 |

### I. 集群下的项目详情入口（老 `/clusters/:cluster/projects/:namespace/...`，16 条）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/projects/:namespace 及其下 deployments/statefulsets/daemonsets/jobs/cronjobs/pods(+containers)/services/ingresses/secrets/configmaps/serviceaccounts/volumes/volume-snapshots/networkpolicies 详情` | — | ✗ | 老 console 允许「从集群管理直接进入某个项目的资源详情」；新 UI 的项目页只挂在 `/:workspace/clusters/:cluster/projects/:namespace` 下，必须经过 workspace 上下文。**这是入口能力缺口，不是页面缺失** |

### J. 项目作用域（老 `/:ws/clusters/:cluster/projects/:ns`）

| 老路由 | 新 UI 路由 | 判定 | 说明 |
| --- | --- | --- | --- |
| `/overview` | `overview` | ✓ |  |
| `/applications、/applications/composing(+:name)、/applications/template(+:id)` | — | ✗ | composing 部分不依赖 openpitrix（CRD 应用），template 依赖 openpitrix |
| `/deployments(+:name)` | `deployments(+$name)` | ✓ |  |
| `/statefulsets(+:name)` | `statefulsets(+$name)` | ✓ |  |
| `/daemonsets(+:name)` | `daemonsets(+$name)` | ✓ |  |
| `/jobs(+:name)` | `jobs(+$name)` | ✓ |  |
| `/cronjobs(+:name)` | `cronjobs(+$name)` | ✓ |  |
| `/pods` | `pods` | ✓ |  |
| `/pods/:podName` | `pods/$name` | ✓ |  |
| `/pods/:podName/containers/:containerName` | — | ✗ | **独立容器详情页**（资源状态含探针/生命周期/卷挂载、4 条监控曲线、环境变量、容器日志 + 终端按钮） |
| `/services(+:name)` | `services(+$name)` | ✓ |  |
| `/ingresses(+:name)` | `ingresses(+$name)` | ✓ |  |
| `/s2ibuilders(+:name)` | — | ⊘ | 依赖 devops 模块 |
| `/grayrelease（cates / jobs）` | — | ⊘ | 依赖 servicemesh 模块 |
| `/volumes(+:name)` | `persistentvolumeclaims(+$name)` | ⇄ | 改名 volumes → persistentvolumeclaims |
| `/volume-snapshots(+:name)` | `volumesnapshots(+$name)` | ✓ |  |
| `/base-info` | `baseinfo` | ✓ |  |
| `/networkpolicies` | `networkpolicies` | ⇄ | 列表已迁，详情未迁 |
| `/networkpolicies/:name` | — | ✗ |  |
| `/configmaps(+:name)` | `configmaps(+$name)` | ✓ |  |
| `/secrets(+:name)` | `secrets(+$name)` | ✓ |  |
| `/serviceaccounts、/serviceAccounts/:name` | `serviceaccounts(+$name)` | ✓ | 老 console 详情路径拼作 `serviceAccounts`（大小写不一致） |
| `/roles` | `roles` | ⇄ | 列表已迁，详情未迁 |
| `/roles/:name` | — | ✗ |  |
| `/members` | `members` | ✓ |  |
| `/log-collections` | `log-collections` | ✓ |  |
| `/gateways` | `gateways` | ⇄ | 列表已迁，详情未迁 |
| `/gateways/:gatewayName` | — | ✗ |  |
| `/alert-rules、/alert-rules/:name（含 builtin）` | `alertingrules` | ⇄ | 改名 alert-rules → alertingrules；详情未迁 |
| `/alerts` | `alerts` | ✓ |  |
| `/custom-monitoring` | — | ✗ | 自定义监控（需图表引擎） |

### 映射表计数

> 本表 140 条映射条目覆盖 192 条老路由（带详情页的条目已合并计数，如 `applications(+:name)` 一条覆盖两条）。分布如下：

| 判定 | 条数 |
| --- | --- |
| ✓ 已迁移 | 31 |
| ⇄ 有替代 | 15 |
| ✗ 真缺失 | 74 |
| ⊘ 有意不迁移 | 20 |
| **合计** | **140** |

---

## 9. 时效性与复现方式

### 9.1 时效性（重要）

分析期间仓库有**并发提交**（另一个会话在同步推进迁移）。本文件的基线是 `abea36211`，期间发生的变化：

- `settings/mail`、`PlatformInfoPage`、`UserSettingsDialog` 从「未提交改动」变成「已提交」（`e572b8e01`），§3.2 与 §4.7 已按「正在迁移中」记录。
- `page-parity-report.md` 被改过两次（新增「管理员重置他人密码」登记、新增 user-settings 小节）。
- `prd/tools/parity_check.py` 增加了平台作用域映射与「未登记页面」检查（`0305317e7`）。
- **通知渠道正在被并发迁移**：交付时工作树里新增了 `settings/{dingtalk,wecom,slack,webhook}` 四个路由与 `ChannelConfigPage.tsx`（`MailChannelPage.tsx` 被删除）。§3.2 与 F-28 已按此更新；**飞书（feishu）与第三方登录仍未迁移**。

**复核时先 `git log --oneline -10` 对齐基线**，再逐条验证。缺口条目本身（尤其是整块作用域缺失）不会因为几次提交而消失。

### 9.2 老 console 路由计数脚本

§0.2 的 200 条路由由下面的脚本从源码抽取（已剔除 `*`、空路径与重定向）：

```python
import re
from pathlib import Path
from collections import Counter

ROOT = Path('console')
OLD = ROOT / 'src/pages'
Q, BT = chr(39), chr(96)
VAL = '([' + Q + BT + '][^' + Q + BT + ']*[' + Q + BT + ']|\\[[^\\]]*\\])'
PAT = re.compile('path:' + r'\s*' + VAL)

SCOPE = {'console': 'global', 'access': 'access', 'settings': 'settings', 'apps': 'appstore',
         'workspaces': 'workspace', 'devops': 'devops', 'fedprojects': 'federated',
         'clusters': 'cluster', 'projects': 'project'}
BASES = {'project': '/:workspace/clusters/:cluster/projects/:namespace',
         'federated': '/:workspace/federatedprojects/:namespace',
         'cluster': '/clusters/:cluster',
         'devops': '/:workspace/clusters/:cluster/devops/:devops',
         'workspace': '/workspaces/:workspace',
         'access': '/access', 'settings': '/settings', 'appstore': '/apps-manage', 'global': ''}

rows = []
for f in sorted(OLD.glob('*/routes/*.js')):
    scope = SCOPE[f.parts[-3]]
    txt = f.read_text(encoding='utf-8', errors='replace')
    consts = dict(re.findall('const (\\w+) = [' + Q + BT + ']([^' + Q + BT + ']+)[' + Q + BT + ']', txt))
    consts.setdefault('PATH', BASES[scope])
    for m in PAT.finditer(txt):
        for p in re.findall('[' + Q + BT + ']([^' + Q + BT + ']*)[' + Q + BT + ']', m.group(1)):
            q = p
            for k, v in consts.items():
                q = q.replace('${' + k + '}', v)
            rows.append((scope, q))

uniq = {}
for scope, p in rows:
    if not p or p == '*' or p.endswith('/'):
        continue
    uniq.setdefault((scope, p), True)

c, det = Counter(), Counter()
for (scope, p) in uniq:
    c[scope] += 1
    base = BASES[scope]
    if base and p.startswith(base + '/') and ':' in p[len(base) + 1:]:
        det[scope] += 1

for s in ['global', 'access', 'settings', 'appstore', 'workspace', 'devops', 'federated', 'cluster', 'project']:
    print(f'{s:10} routes={c[s]:>4} details={det[s]:>3} listpages={c[s] - det[s]:>4}')
print('TOTAL', sum(c.values()), 'details', sum(det.values()), 'listpages', sum(c.values()) - sum(det.values()))
```

输出：

```text
scope       routes details listpages
global           7       0         7
access           5       2         3
settings         9       0         9
appstore         7       2         5
workspace       14       4        10
devops          11       3         8
federated       23       9        14
cluster         74      34        40
project         50      21        29
TOTAL          200      75       125
