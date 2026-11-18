# 工作负载列表（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/list.md)

## 概述

八种负载共用一个列表组件 `WorkloadListPage`，由描述符区分标题、列与状态。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08`
- `prd/kube-frontend/app-workloads/list.md`

## 设计目标与非目标

让八种资源的列表在「列、状态、空态、agent 句柄」上只有一份实现，避免八份近似代码各自漂移。非目标：不做创建表单、不做列显隐。

## 关键约束

- `rowKey` 为 `name`；排序键用上游拼写 `name` / `createTime`。
- 状态列只在描述符 `showStatus` 为真时出现；就绪列只在 `showProgress` 为真时出现。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01 — 一个页面 + 描述符，而不是八个页面

**为什么**：八种资源的差异只有标题、列与状态映射。八份页面会让「空态文案」「批量删除」「agent 句柄」这类共性在校对时逐一漏掉——老 console 正是这样积累了三套不同的空态写法。

**被否方案**：为每种资源生成一个页面文件（更「直白」，但改动要乘八）。

**何时重新考虑**：出现与列表结构不同的资源（例如需要树形展示）时，单独成页。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02 — 名称用普通 `<a href>`，不强制走类型化 Link

**为什么**：页面详情与列表在同一个路由文件夹内，列表没有独立的路由 ID 可供类型化跳转；而 `<a href>` 保留了中键与 ⌘ 点击的行为，普通点击由布局的 `onNavigate` 转成客户端跳转。

**被否方案**：给详情建独立路由 ID 再用 `<Link>`。会让「同一页面的列表与详情」重新分裂成两个路由文件。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04 - 容器组的节点与 IP 列取自对象本身

**为什么**：老 console 的容器组列表有「所在节点」「容器组 IP」两列，这正是排查「Pod 起来了但调度到哪」的第一个问题。两列都来自 Pod 对象（`spec.nodeName` / `status.podIP`），不需要额外请求。

**被否方案**：从关联工作负载推断节点。工作负载没有节点概念，Pod 才有。

**状态筛选为何不在此条**：这一条只讲两列取值。筛选曾经因为 `fieldSelector=status.phase=…` 在 kapis 代理上返回 0 条而被列为「不做」，本批查清了代理真正支持的参数是 `status=`，改由 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05` 承接。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05 — 状态筛选用 kapis 的 `status=`，不用 fieldSelector

**为什么**：容器组的四个状态（Waiting / Running / Completed / Error）不是 `status.phase` 的枚举——kubectl 的「状态」是 `statusType`：Pending 的 Pod 可能是 Waiting，也可能是 Error；Succeeded 是 Completed；一个 Running 的 Pod 里某个容器 `CrashLoopBackOff` 时 kubectl 显示的不是 Running。服务端 `kube-server` 的 pods getter 按这个 `statusType` 过滤，参数名就是 `status=`（实测 `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/default/pods?status=Running` 返回该命名空间里唯一运行中的 Pod，`?status=Waiting` 返回 0 条）。因此筛选键必须与这个派生口径一致，否则前端筛的和徽标显示的不是同一个东西。

**实测的两个坑**（2026-11-18，mlu370）：

- 同一端点 `?fieldSelector=status.phase=Running` 返回 **0 条**：kapis 的资源代理把 `fieldSelector` 透传给聚合层，聚合层不认这个字段，静默过滤成空集。**不是**「没有数据」。
- 未知查询键会被当成过滤器：`?status=Bogus` 返回 0 条而不是报错。所以拼错键名（例如 `phase=`）在页面上表现为「这个项目没有容器组」，最难排查的那类失败。

**被否方案**：前端拉全量再本地过滤。与服务端分页直接冲突——第 2 页的 Pod 可能属于被筛掉的页，总数也变成「当前页里匹配的条数」。旧 console 也是服务端过滤。

**被否方案**：用 `/api/v1/namespaces/<ns>/pods?fieldSelector=status.phase=Running` 绕开代理。核心 API 认这个参数，但它只认 `status.phase`，口径与徽标不同（Pending 的 CrashLoopBackOff Pod 会被算成 Pending 而不是 Waiting/Error），而且列表统一走 kapis，多一条读路径就多一处口径分歧。

**何时重新考虑**：kapis 代理开始支持 `fieldSelector` 的 `status.phase`，或服务端提供「多状态」筛选参数时，把选项与参数映射收敛到一处。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06 — 节点列是链接，节点 IP 取 `status.hostIP`

**为什么**：看到「这个 Pod 在哪台机器上」之后的下一句一定是「那台机器怎么了」。旧 console 的节点列就是 `Link to /clusters/:cluster/nodes/:node`，文本是「节点名 + 节点 IP」。节点 IP 用 `status.hostIP`（节点自身地址，由 kubelet 上报），不是 `status.podIP`：两个 Pod 在同一节点上时 Pod IP 各不相同，而节点 IP 是定位机器的那一个。

**为什么未调度时是纯文本 `-`**：没有节点就没有可跳转的目标。渲染成禁用链接或空 href 会让人以为「能点但坏了」，`-` 是「这个字段不存在」的既有写法。

**被否方案**：整格可点（含 `-` 的情况）→ 与行操作菜单冲突，且未调度时点出 404。

**何时重新考虑**：节点页支持按 Pod 反查时，可把「该节点上的容器组」做成第二段链接。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07 — 状态原因只在「比阶段更有信息」时显示

**为什么**：旧 console 在名称下方用 `StatusReason` 显示容器的 `waiting.reason` / `terminated.reason`。直接照搬会把 `Running`、`Pending` 这类与阶段同名的值也显示一遍——徽标已经说了「运行中」，下一行再写 `Running` 只是噪音，还占掉列表的行高。因此规则是：原因等于阶段、或属于 `Running/Pending/Succeeded/Failed/Completed/Unknown/Terminating` 这类纯阶段名时不显示；`CrashLoopBackOff`、`ImagePullBackOff`、`ContainerCreating`、`Init:0/1` 这类才追加。

**为什么放在状态列而不是名称列**：新列表的名称列已经有别名与 `app` 副行，再塞原因会把两件事挤在一列；状态列本来就是「为什么是这个状态」的答案位置，徽标在上、原因在下，读起来是一句话。

**被否方案**：沿用旧版放在名称下方。名称列的副行已被 `app` 占用，两个副行会让人分不清哪个是身份、哪个是状态。

**被否方案**：把所有容器的 reason 聚合进列表（多容器时拼接）。列表只回答「这个容器组怎么了」，容器级的细分留给容器详情页。

**何时重新考虑**：列表需要按原因筛选时（例如「只看 CrashLoopBackOff」），届时原因要成为服务端可过滤的字段。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08 — 集群作用域的容器组列表复用同一套 `status=` 与节点链接口径

**为什么**：集群作用域的容器组列表（`/kube-frontend/clusters/<cluster>/pods`，旧 console 的 `clusters/containers/Workload/Pods`）回答的是另一个问题——「整个集群里哪些容器组不正常」，而不是「这个项目里有哪些」。旧页同样有 `PODS_STATUS` 四态筛选与节点链接，新页原来两者都缺，于是这个页面只能靠翻页找异常。补齐时**不新增第二套规则**：筛选值仍是 kapis 的 `status=<Waiting|Running|Completed|Error>`（同一个 pods getter、同一个 `statusType` 口径），节点列仍是「节点名 + 节点 IP，链到该集群节点详情」，未调度显示 `-`。

**为什么口径必须相同**：两个页面看的是同一批对象。如果集群页用 `fieldSelector=status.phase` 而项目页用 `status=`，同一个容器组会在两页显示为不同状态（Pending 的 CrashLoopBackOff 容器组在一边是「等待中」、在另一边是「Pending」），读者无法判断哪个对。实测（2026-11-18 mlu370）集群作用域端点同样只认 `status=`：`/kapis/resources.kubesphere.io/v1alpha3/pods?status=Running` 返回 125 条、`?status=Waiting` 返回 2 条、`?status=Error` 返回 0 条，而 `fieldSelector` 在项目作用域实测返回 0 条。

**被否方案**：集群页做「按项目下拉 + 状态」组合筛选。项目下拉是另一个功能（项目作用域列表已有），两个控件叠加会让「整集群」这个默认视角变复杂；本批只补旧页有的两个能力。

**被否方案**：集群页复用项目页组件并传空命名空间。组件内部的行链接、项目列、详情路由都以项目为前提，硬塞空命名空间会把「所属项目」这一列和详情跳转一起弄坏——因此集群页保留自己的页面与列，只共享派生函数（`toWorkloadSummary` / `podStatusReason`）与筛选值集合。

**何时重新考虑**：需要「跨集群」视图（多集群聚合）时，作用域再上一层，届时把三处列表的筛选与列定义收敛成一份描述符。

## 系统现状

老控制台 `pages/projects/containers/{Deployments,StatefulSets,...}/index.jsx` 各自实现列表；新实现抽出一份，并由 `descriptor` 提供差异。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/WorkloadListPage.tsx`
- `apps/console-next/src/pages/app-workloads/queries.ts`（描述符、查询、manifest）
- 路由：`src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/<resource>/`

## 对外契约

读 `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/<resource>`；删除走原生端点（按 API 组）。

容器组列表的筛选参数（同一个读端点，只加一个查询键）：

| 用途 | 请求 | 返回 |
| --- | --- | --- |
| 状态筛选（项目作用域） | `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/pods?status=<Waiting\|Running\|Completed\|Error>&page&limit&sortBy` | JSON 列表（`items[]` + `totalItems`），服务端按 `statusType` 过滤 |
| 状态筛选（集群作用域） | `GET /kapis/resources.kubesphere.io/v1alpha3/pods?status=<同四个值>&page&limit&sortBy` | 同上，但跨命名空间；行上带 `metadata.namespace`（页面用它渲染「所属项目」并拼详情链接） |

- 键名固定为 `status`，取值只有上面四个；空值表示不过滤（不要发 `status=` 空串）。项目作用域与集群作用域共用这组取值：集群端点没有 `namespaces/<ns>` 段，其余参数与语义完全相同。
- **不发** `fieldSelector`：实测该端点对它返回 0 条；也**不要**发其它未知键（`?phase=` 之类同样静默返回 0 条）。
- 行内字段：节点 `spec.nodeName`、节点 IP `status.hostIP`、容器组 IP `status.podIP`、状态原因由容器状态派生（`status.containerStatuses[].state.waiting/terminated.reason`、init 容器同理）。

## 不变量

- 同一种资源在列表与详情上的状态一定相同（同一个 `workloadStatus`）。
- 写操作的目标路径与资源所属 API 组一致。
- 状态筛选的选中值只影响请求参数，不改变行的状态派生：同一行在筛选前后显示同一个徽标与同一个原因。
- 状态原因与阶段同名时不显示原因（`INV` 见下），未调度行的节点列不生成链接。
- 「所在节点」的节点 IP 恒为 `status.hostIP`，与「容器组 IP」（`status.podIP`）不共用取值。
- 两个作用域的容器组列表对同一个对象给出同一状态与同一原因（同一派生函数、同一 `status=` 取值）。
- 集群作用域的行必须带所属项目，否则无法拼出该对象在项目控制台里的详情地址。

## 已知坑

- **状态筛选的两个静默空表**（2026-11-18 mlu370 实测）：`?fieldSelector=status.phase=Running` 返回 0 条；`?status=Bogus` 也返回 0 条（未知键被当过滤器）。页面此时显示「没有容器组」，看起来像数据没了——改筛选键前先 `curl` 一次看 `totalItems`。
- **`status` 的取值大小写**：服务端认 `Waiting` / `Running` / `Completed` / `Error`（首字母大写），传小写不报错但匹配不到，同样是空表。
- **节点链接的路径不带工作空间与项目段**：节点是集群作用域，`/kube-frontend/clusters/<cluster>/nodes/<node>`。照着列表页的 `projects/<ns>` 前缀拼会 404。
- **原因不是 `status.reason`**：Pod 的 `status.reason` 只在少数情况有值（如 `Evicted`），日常的 `CrashLoopBackOff` 在容器的 `state.waiting.reason` 里；init 容器要读 `initContainerStatuses`，否则 `Init:0/1` 这类显示不出来。
- **未调度的行不要造链接**：`spec.nodeName` 为空时拼出 `/nodes/` 会 404；显示 `-` 才是「没有这个字段」。
- **集群作用域端点没有命名空间段**：`/kapis/resources.kubesphere.io/v1alpha3/pods` 才是跨命名空间的那个；写成 `/namespaces//pods`（空命名空间）会 404 或返回空。
- **行链接要靠 `metadata.namespace` 反查工作空间**：容器组不带 workspace，集群页要把命名空间索引成「命名空间 → 工作空间」才能拼出项目控制台的详情地址；反查不到时行不可点，而不是拼一个 404 链接。
- **集群页的筛选同样会静默空表**：`?status=Bogus`、小写取值、`fieldSelector` 都返回 0 条（与项目作用域同因）。
- **写路径前缀**：`/api/v1` 只服务核心组。Deployment/StatefulSet/DaemonSet 在 `apps/v1`，Job/CronJob 在 `batch/v1`，Ingress 在 `networking.k8s.io/v1`。第一版写死 `/api/v1`，导致这些资源的编辑 YAML 与重新部署全部 404。
- **kubectl 的 `readyReplicas` 缺失**：控制器还没写状态时该字段不存在，不能当 0 处理成「已停止」。

## 测试与可观测

- 单测：`api-client/test/workloads.test.ts`（状态分支）、`api-client/test/resources.test.ts`（API 组路由）、`api-client/test/pods.test.ts`（状态原因与「原因是否有信息量」的判定）。
- E2E：`tests/kube-frontend/app-workloads/`；本批新增 `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05/06/07`。
- 可观测点：`pods:filter:status`（筛选下拉，选项文案即四项状态）、`pods:node:<行名>`（节点链接，href 指向 `/clusters/<cluster>/nodes/<node>`）、`pods:reason:<行名>`（状态原因文本，无原因时不存在）。
- 用例判定口径：先用 kapis 的 `status=` 读一次总数，再与页面行数比对；这样断言的是「页面与服务端同一口径」，而不是「恰好有几条数据」。

## 后续改进

- 创建/编辑信息的表单能力；扩缩容。
- 列显隐与列宽拖拽。
- 按状态原因筛选（需要服务端把原因变成可过滤字段）。
- 集群作用域列表的项目筛选（与项目作用域的项目下拉合成同一套控件）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08`
