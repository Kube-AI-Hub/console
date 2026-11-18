# 详情页页签（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/detail-tabs.md)

## 概述

空降在共用详情组件 `WorkloadDetailPage` 上的页签层：`tabsFor(kind)` 推导页签集合，页签栏用 ui 包的 Button + ARIA role，各面板按选中项渲染。数据获取全部留在页面顶层，页签只决定渲染哪一块。

容器组是本批唯一有七个页签的类型（概览 / 调度信息 / 监控 / 容器 / 环境变量 / 事件 / 元数据）。「调度信息」与「环境变量」是恢复旧 console 的场景（旧页 `Pods/Detail/routes.js` 的 `/schedule` 与 `/env`），不是新造的功能点。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05

## 设计目标与非目标

目标：把部署详情的五个页签、容器组详情的七个页签做进共用组件；切换页签不重新加载数据；既有 `data-ai-id` 保持可达。

非目标：不做页签深链（不写入 URL）；不为页签单独取数（环境变量的 `valueFrom` 解析是唯一例外，见 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-08`）；不为容器组新增日志/终端页签。

## 关键约束

- 页面禁止裸 `<button>`；`@kube-ai-hub/ui` 当前没有导出 Tabs，触发器只能用该包的 `Button` 加 `role="tab"`。
- 所有查询（详情、容器组、修订版本、事件、自动伸缩、任务执行记录）必须留在页面顶层；挪进页签面板会导致切走即销毁查询、切回重新请求。
- 既有区块 id 不变：`<kind>-detail:pods`、`<kind>-detail:revisions`、`<kind>-detail:events`、`<kind>-detail:event-list` 等仍在对应页签内。
- 事件按 `involvedObject.name` + `involvedObject.kind` 过滤；容器组不是唯一有事件的资源。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01 — 页签集合由资源类型推导，数据留在页面顶层

**为什么**：老 console 的部署详情有 6 个页签、容器组详情 6 个页签，而新页面的八个资源共用 `WorkloadDetailPage`。若把「哪些页签」写进 JSX，就会出现八处分支；改为 `tabsFor(kind)` 返回数组，页面只渲染数组，新增资源时只改一个函数。

数据必须留在页面顶层：React Query 的缓存挂在调用它的组件上。如果把 `useWorkloadPods` 之类挪进页签面板，切走再切回就会重新请求，还会重置 15 秒刷新的计时。页签面板只决定「渲染哪一块」，不决定「取什么数据」。

**被否方案**：每个页签一个自带查询的子组件。读数正确，但每次切页签都发一次请求，且容器组列表会在切走时停止刷新——与「切页签不重新加载」的验收点直接冲突。

**何时重新考虑**：某个页签的数据量或刷新频率明显独立于页面（例如事件需要分页或实时流）时，再把它拆成独立子资源，并显式声明自己的缓存策略。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02 — 页签触发器用 Button + ARIA role，而不是等待新组件

**为什么**：`@kube-ai-hub/ui` 的 Tabs 只在 ai-kit 内部存在（`primitives/Navigation.tsx`），没有从 ui 包导出；页面契约又禁止裸 `<button>`。用 ui 包的 `Button` 加 `role="tab"` / `aria-selected`，并让面板带 `role="tabpanel"`，既满足契约，也保留键盘与读屏语义。

**被否方案**：从 `@kube-ai-hub/ai-kit` 直接 import Tabs。绕过了「页面只 import ui 包」的分层，且 Navigation.tsx 的样式与 ui 包的按钮密度不一致。

**何时重新考虑**：ui 包开始导出 `Tabs` / `TabsContent` 时，只换触发器与容器，页签集合与面板不变。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03 — 只有选中页签的面板挂载

**为什么**：六个面板全量渲染会把所有区块塞进 DOM：容器组表每 15 秒刷新，事件列表可能很长，隐藏面板也照样参与重渲染。只挂选中面板让「切页签」成为一次正常的卸载/挂载，数据仍在 React Query 缓存里，因此不会重新请求。

**代价（已知坑）**：非选中页签里的既有区块在 DOM 中不存在，直接找区块的旧用例会失败。本轮已同步更新用到容器组、修订版本、事件区块的四条用例（PODS_BLOCK / REVISIONS / POD_EVENTS / SERVICE_PODS），先点页签再断言。

**被否方案**：全部挂载再用 `hidden` 藏起来。DOM 体积与重渲染代价都更高，而且 `to_be_visible` 仍然为假，旧用例一样要改。

**何时重新考虑**：页签数量或面板重量增长到「初始化一个页签明显卡顿」时，再考虑懒加载面板内容。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04 — 事件读取抽成 `objectEventsApi`，容器组复用

**为什么**：控制器页签的「事件」是对象自身的事件（部署的滚动更新、调度失败都会记在 Deployment 上），不是它某个 Pod 的事件。Kubernetes 没有按对象取事件的端点，只能用 `involvedObject.name` + `involvedObject.kind` 过滤命名空间事件集合。把这段映射抽成 `objectEventsApi`，`podEventsApi` 变为 `kind='Pod'` 的薄封装，两条路径共用同一套字段归一化与排序。

**被否方案**：控制器事件聚合它所有 Pod 的事件。要按 Pod 逐个请求（N 次），而且答的是「Pod 怎么了」而不是「这个部署怎么了」。

**何时重新考虑**：事件接口支持按对象或按 UID 查询时，改为单次精确请求。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05 — 容器组的调度信息与状态条件直接读已取的容器组对象

**为什么**：调度结果（节点、`PodScheduled` 的 `lastTransitionTime`）、四项条件、GPU 分配都在容器组详情响应里：`spec.nodeName`、`status.conditions[]`、`metadata.annotations`。详情页顶层已经取过这个对象，页签再发一次请求只会让「同一个页面的两个数字来自两次响应」——时间对不上时读者无从判断哪个是真的。

**实测口径**（2026-11-18 mlu370）：未调度的容器组（`nodeSelector` 指向不存在的节点）`status.conditions` 里是 `PodScheduled=False`、`reason=Unschedulable`；已调度的容器组 `PodScheduled=True` 且带 `lastTransitionTime`。因此「已调度 / 未成功」判两处：`spec.nodeName` 是否为空，以及条件是否 `True`——两者都看，避免条件还没写入时把已绑定的容器组显示成未调度。

**被否方案**：单独请求 `/kapis/.../pods/<name>/status` 或事件接口补时间。多一次往返，且与页面其余字段不同源。

**被否方案**：用事件（`Scheduled` 事件的时间）代替条件时间。事件会被清理（默认 1 小时 TTL），条件不会；用会消失的数据做长期展示，等于让页面随时间自己变空。

**何时重新考虑**：需要「调度耗时」「重试次数」这类条件里没有的量时，再引入事件或调度器指标。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-06 — GPU 分配来自注解，按设备一行，uuid 链到该设备的状态页

**为什么**：GPU 分配不是 Pod 的 API 字段，是设备插件（HAMi 等）写进注解的：键名形如 `kubesphere.io/gpu-*`（本仓库的解析器按「键名包含 `devices-allocated`」识别，兼容 HAMi 的 `hami.io/vgpu-devices-allocated`），值的格式是「容器段用 `;` 分隔、设备段用 `:` 分隔、每个设备四段 `uuid,type,mem,core`」。这是唯一能回答「这个容器组占了哪几张卡、分到多少显存」的数据源。

**为什么按设备一行、uuid 是链接**：读者来这里是为了回答「这块卡还给了谁、它的利用率是多少」，所以每个设备要能一跳就到该设备的详情页（`/kube-frontend/clusters/<cluster>/gpus/<uuid>`，集群 GPU 列表的单卡页 `GpuDetailPage`；uuid 去掉 MIG 后缀 `[1-1]` 才是物理设备）。

**与旧路由的对应（等价承接，不是删减）**：旧 console 的链接是节点下的 `/clusters/<c>/nodes/<node>/gpus/<uuid>/status`；新 UI 没有这条路由，收敛为**集群级单卡页**，用 uuid 查该卡并显示它所在的节点与监控。两种形态都能回答「这块卡在哪、现在什么状态」，区别只在路径形状：单卡页以设备为主键，节点从设备反查（同一个设备只可能在一台机器上），因此链接不带节点段。若将来需要「该节点上的所有卡」这一视角，再加节点下的 GPU 列表，而不是把单卡页搬回节点路径。

**为什么没有注解就不渲染区块**：绝大多数容器组没有 GPU。渲染一个空区块会在每个容器组详情上占一块位置，读者还得读一遍才知道「它没要 GPU」。

**被否方案**：从 `spec.containers[].resources.limits['nvidia.com/gpu']` 推断分配。那只是「要几张卡」，答不出「哪几张、多少显存、算力占比」，而后者正是注解存在的理由。

**被否方案**：解析失败时显示原文。注解是第三方写的，格式不一致时一行乱码比不显示更糟；解析器只接受四段齐全的设备段，其余忽略。

**何时重新考虑**：设备分配成为 Pod 的正式字段（例如 DRA 的 `ResourceClaim`）时，改为读字段并保留注解作为兜底。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-07 — 状态信息只列 kubectl 的四项条件，缺项不造行

**为什么**：`status.conditions` 是列表，内容随版本变化（`DisruptionTarget`、`PodReadyToStartContainers` 等新类型会陆续出现）。页面固定只列 PodScheduled / Initialized / ContainersReady / Ready 四项——这四项是 kubectl `describe pod` 的第一屏，也是「为什么没起来」的判据。固定集合让页面在不同集群上长得一样，也避免每次 API 加条件就多出一行没人认识的条目。

**为什么缺项不造行**：容器组刚创建时 `Initialized` / `ContainersReady` 可能还没写入。造一行「未知」会让读者以为状态异常；不显示才是「还没到这一步」。

**被否方案**：把 `status.conditions` 全量渲染。条件类型是开放集合，全量渲染会让页面在不同版本上出现不同行数，视觉与断言都不稳定。

**被否方案**：把条件折叠进 tooltip（旧 console 的做法）。排障时「未满足」的原因与消息正是要读的内容，藏在悬停里等于要人多一次动作才能看到。

**何时重新考虑**：出现第 5 个需要长期展示的条件（例如 DRA 相关）时，把集合提到一处常量并同步 AC。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-08 — 环境变量页签按引用读 ConfigMap / Secret，读不到显示来源

**为什么**：`env[].valueFrom` 只有引用没有值。旧 console 的 `EnvStore.fetchVariables` 会把引用换成实际值：Secret 的 `data[key]` 先 base64 解码，ConfigMap 的 `data[key]` 是明文。不解析的话页面只能显示「secretKeyRef:db-secret/password」——读者还是得自己去保密字典页翻。

**与旧实现的差别（本批刻意改的）**：旧实现把所有引用放进一个 `Promise.all`，任何一个读失败就整块 reject，页面变成空白。新实现按引用逐个读、缓存同一对象，读不到时保留「引用 X（读取失败）」——「读不到」与「值为空」是两件事，前者要人去看权限或对象是否存在，后者只是变量为空。

**为什么在页面顶层解析一次**：页签切走再切回不该重新读 Secret（那是 N 次额外请求）。解析放在页面顶层的查询里，页签只负责展开面板。

**被否方案**：把解析放进页签面板。切页签就重读一次，Secret 多时是明显的卡顿，也让「切页签不重新取数」这条不变量破例。

**被否方案**：只显示引用，不解析。等于把旧页最有价值的一块能力（看到真实值）退化成一行指针。

**何时重新考虑**：`valueFrom` 支持更多引用类型（`fieldRef` 的运行时值客户端读不到）时，或服务端提供「解析后的 env」端点时。

## 系统现状

老 console 每个资源各有一份 Detail 目录，结构相同、字段不同；部署详情在旧 console 里已有 概览 / 容器组 / 修订版本 / 事件 / 元数据 等页签，容器组详情有 资源状态 / 调度信息 / 元数据 / 监控 / 环境变量 / 事件 六个页签。新 UI 此前把所有区块纵向堆在共用详情页里，本功能点补上页签层但不改数据层；容器组侧补的四个页签（调度信息、监控、容器、环境变量）对应旧页的 `/schedule`、`/monitors`、容器列表与 `/env`。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx`：`tabsFor`、`TAB_LABEL_KEYS`、页签栏与六个面板
- `packages/api-client/src/workloads.ts`：`objectEventsApi`（`podEventsApi` 复用）
- `packages/locales/src/index.ts`：`workloads.detail.tab.*` 与 `metadata.*` 键（共享文件，由 Lead 补齐）

## 对外契约

- 页签触发器：`data-ai-id="workload-detail:tab-trigger:{overview|schedule|monitor|pods|revisions|containers|env|events|metadata}"`
- 页签面板：`data-ai-id="workload-detail:tab:{...}"`，只渲染选中项
- 既有区块 id 不变：`<kind>-detail:pods`、`<kind>-detail:revisions`、`<kind>-detail:events`、`<kind>-detail:event-list`、`<kind>-detail:containers`、`<kind>-detail:labels`、`<kind>-detail:annotations`

容器组「调度信息」页签（全部数据来自同一次详情响应，无额外请求）：

| 区块 | 句柄 | 内容 | 数据来源 |
| --- | --- | --- | --- |
| 调度结果 | `pods-detail:schedule-result` | 「已调度到节点 {node}」或「调度未成功」；调度时间 `pods-detail:scheduled-at` | `spec.nodeName`、`status.conditions[type=PodScheduled]` |
| 调度结果 · 节点链接 | `pods-detail:scheduled-node` | 节点名，链到 `/kube-frontend/clusters/<cluster>/nodes/<node>` | 同上 |
| GPU 分配 | `pods-detail:schedule-gpu`（无注解时不渲染） | 每设备一行；uuid 链接 `pods-detail:gpu:<uuid>` → `/kube-frontend/clusters/<cluster>/gpus/<uuid>` | 注解 `*devices-allocated` |
| 状态信息 | `pods-detail:schedule-status` | 当前状态 `pods-detail:current-status`；四条件行 `pods-detail:condition:<PodScheduled\|Initialized\|ContainersReady\|Ready>` | `status.conditions[]` |

容器组「环境变量」页签：

| 元素 | 句柄 | 说明 |
| --- | --- | --- |
| 容器卡片 | `pods-detail:env:<容器名>` | `<details>`，init 容器在前，首张默认 `open` |
| 变量行 | `[data-ai-row="<变量名>"]`（在卡片内） | 名称 + 值（或掩码 / 引用来源） |
| 空态 | `pods-detail:env-empty` | 「没有环境变量。」 |
| 读取失败 | 变量行内显示「引用 configMapKeyRef:<name>/<key>（读取失败）」 | 保留来源，不显示空串 |

环境变量解析的读路径：`GET /kapis/.../secrets/<name>`、`GET /kapis/.../configmaps/<name>`（同命名空间，按 `valueFrom` 引用逐个读、同对象只读一次）。Secret 的 `data[key]` 按 base64 解码，ConfigMap 的 `data[key]` 明文；变量名含 `password` / `secret`（大小写不敏感）时值显示 `******`。

## 不变量

- 页签集合只由 kind 决定，与数据是否加载完成无关（避免页签在加载完成后跳出来）。
- 切换页签不发起新请求、不重置查询缓存；同一份数据在页签间共享。
- 每个页签面板带稳定 `data-ai-id`，且至少包含一个既有区块或空态文案。
- 默认页签恒为「概览」。
- 容器组页签顺序固定为 概览 / 调度信息 / 监控 / 容器 / 环境变量 / 事件 / 元数据；七项不随数据增删。
- 调度信息里的每个值都能在同一份容器组对象里找到同名来源（节点、条件时间、条件明细、注解设备），不出现「页面上有、对象里没有」的数字。
- GPU 分配区块的可见性只由注解决定；条件行的可见性只由 `status.conditions` 里是否存在该 type 决定。
- 环境变量的解析失败不隐藏变量行：行仍在，值位显示引用来源。

## 已知坑

- **`PodScheduled` 条件可能比 `spec.nodeName` 晚到**：只看条件会把刚绑定的容器组显示成「调度未成功」；只看 `nodeName` 又会漏掉「已绑定但条件 `False`」的异常态。判「已调度」两处都看。
- **条件时间不是创建时间**：`lastTransitionTime` 是「最后一次状态变化」的时间，容器组重启或条件翻转后会变。把它当创建时间显示会让人以为对象刚建。
- **注解里的 uuid 可能带 MIG 后缀**：`GPU-x[1-1]` 是 MIG 实例，物理设备是 `GPU-x`。链接必须用物理 uuid，否则设备状态页 404。
- **`valueFrom` 的引用对象可能读不到**：不存在、无权限、跨命名空间（`valueFrom` 不允许跨命名空间）都会失败。旧实现整块 reject 导致空白，新实现逐条保留来源——不要为了「干净」把失败条目过滤掉。
- **Secret 值是 base64**：直接显示 `data[key]` 会是一串 base64；解码失败时保留原文而不是显示空串，否则「二进制 Secret」看起来像「空值」。
- **掩码只看变量名**：`password` / `secret` 出现在名字里就掩码（`DB_PASSWORD`、`MY_SECRET_KEY`），不判断值像不像密码。误掩码比泄漏便宜。
- **环境变量页签会发请求**：这是「切页签不取数」的唯一例外（按 `valueFrom` 读 ConfigMap / Secret），用例断言「切页签不重新请求」时要排除这两个路径。
- 非选中页签不渲染面板：直接找 `deployments-detail:pods` 等区块的旧用例必须先点页签。
- 页签文案的 locale 键由 Lead 在共享 locale 文件补齐（`workloads.detail.tab.*`、`metadata.*`）；新增页签时必须先加键，否则 t() 会显示裸键。
- `activeTab` 是本地状态：路由参数变化（切换到另一个同类对象）不会重置它，页面在面板渲染前会做一次「是否属于当前页签集合」的回退。

## 测试与可观测

- E2E：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01`（部署五页签、事件/元数据面板、容器组页签集合、容器行进入容器详情）。
- 本批新增：`TC-…-DETAIL_TABS-02`（调度结果：已调度与未调度两分支）、`-03`（GPU 分配区块：有注解才有、uuid 链接指向设备状态页）、`-04`（状态信息四项条件与明细）、`-05`（环境变量卡片顺序、valueFrom 解析、掩码与空态）。
- 用例造数方式：容器组用原生 `/api/v1` 建（未调度的用不存在的 `nodeSelector`；带注解的用 `kubesphere.io/gpu-devices-allocated`；环境变量引用本批自己建的 ConfigMap / Secret），`finally` 里无条件删除。
- 回归：`tests/ui/tests/kube-frontend/app-workloads/` 下既有用例（已同步四条页签相关定位）。
- 页签句柄同时是 agent 的观测点：点触发器 → 断言面板可见，不需要等待网络。

## 后续改进

- 从 `@kube-ai-hub/ui` 导出 Tabs/TabsContent，替换手写触发器。
- 调度信息的「调度耗时 / 重试次数」需要事件或调度器指标，暂不做。
- 页签可深链（`?tab=events` 或路由子段），刷新/分享后仍停在同页签。
- 面板内数据明显独立时，按 DEC-...-DETAIL_TABS-01 的「何时重新考虑」拆成独立子资源。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05`

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-09 — 定时任务的默认页签是「运行记录」

**为什么**：页签的默认项就是「这个页面为什么被打开」。定时任务的概览只有调度表达式、挂起开关和模板镜像——读者到这里来是为了看「昨晚跑成功没有」，所以默认落在运行记录。老 console 同样把 `records` 设为 index 路由。

**被否方案**：所有资源统一默认「概览」。统一不等于一致：一个每次打开都要再点一次的页签，就是默认项选错了。

**何时重新考虑**：定时任务详情增加「下次触发时间 / 最近失败原因」这类概览级结论时，把结论提到概览并把默认改回去。

