# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11 集群监控 · 页签 IA 与深链（默认概览、?tab=、单一页头控件）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{{BASE_URL}}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

集群监控是「一个导航入口 + 五个页内页签」：概览 / 物理资源监控 / API Server 监控 / 调度器监控 / 资源用量排行；默认落在概览，地址栏 `?tab=` 可深链、刷新保持、非法值忽略（页签切换用 replace，不新增浏览器历史）；页头只有一套时间窗与自动刷新（页签内不再重复），切换页签不请求未挂载页签的数据；页面 surface 的状态跟随当前页签的主查询。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11** — 已知集群已就绪，当打开 `/kube-frontend/clusters/<cluster>/monitor`，则页头显示标题「集群监控」、描述、时间窗按钮组（`cluster-monitor:range:<key>`）与自动刷新开关（`cluster-monitor:auto-refresh`），页头下方是互斥页签条，按固定顺序显示概览、物理资源监控、API Server 监控、调度器监控、资源用量排行五项，并在 etcd 接入监控（ServiceMonitor 探测为 200）时于末尾追加第 6 个 etcd 页签（`data-ai-id="cluster-monitor:tab:<overview|resource|apiserver|scheduler|ranking|etcd>"`，标签取 `cluster.monitor.tab.*`；etcd 页签内容为现有 etcd 组件图与无序列说明），默认选中概览并只渲染 `cluster-monitor:tabpanel:overview`；点「物理资源监控」时选中态与面板切到 `resource`，URL 通过路由 search 参数写回 `?tab=resource`（`navigate({ search: { tab }, replace: true })`，不新增浏览器历史记录；后退/前进不切换页签），刷新或直接粘贴该地址仍停在物理资源页签；`?tab=` 为未知值（例如 `?tab=foo`）或该页签当前不可见（etcd 未接入监控时的 `?tab=etcd`）时按概览渲染，不报错、不改写地址栏其它查询参数；页头的时间窗与自动刷新只有一套，任何页签内都不出现第二套时间窗/刷新控件，切换时间窗或开启自动刷新时当前页签按新区间重新取数；切换页签只为新进入的页签发起其主查询，从未挂载过的页签不发起请求，再次进入已加载页签时在同一时间窗内复用缓存而不重复请求；节点详情复用该页面（传入 `node`）时不渲染页签条、只保留节点作用域趋势，且不读取集群级页签数据；`cluster-monitor:surface` 的 `data-ai-state` 等于当前页签主查询的状态（loading/ready/empty/error），未选中页签的查询不改变该状态。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 按使用场景进入五个页签并可直接深链 (Priority: P1)

作为 **集群管理员**，我希望 **打开监控后按场景在概览、物理资源、API Server、调度器、资源用量排行五个基础页签之间切换（etcd 接入监控时另有条件 etcd 页签），并能把某个页签直接存成链接**，以便 **在排查控制面变慢、磁盘 IO、RDMA 或资源排行时不用在一屏长页面里滚动寻找，刷新或分享后也不会丢失当前场景**。

**Independent Test**：打开监控默认在概览；点「调度器监控」后只显示调度器图表，地址栏出现 `?tab=scheduler`，刷新后仍停在调度器；五个页签都能通过 `?tab=` 直接打开；切页签不触发其它页签的查询；节点详情复用该页面时没有页签条。

## 前置与配置

- 已登录 admin，集群 host 已就绪，监控后端可用
- 当前 build 已包含页签 IA（cluster-monitor:tab:*）

## 测试步骤

1. 打开 /kube-frontend/clusters/host/monitor，等待 cluster-monitor:surface 就绪
2. 核对五个基础页签按 overview → resource → apiserver → scheduler → ranking 顺序排列；默认 overview 被选中（data-state=active），overview 面板可见，其余面板隐藏
3. 核对条件 etcd 页签：本部署 etcd ServiceMonitor 探测为 404，页签条不渲染 cluster-monitor:tab:etcd；打开 ?tab=etcd 时回退 overview；探测为 200 时才在末尾追加 etcd 页签（正分支用 page.route mock 200 由 pytest 覆盖）
4. 依次点击 resource / apiserver / scheduler / ranking：每次核对地址栏出现 `?tab=<key>`、该页签被选中、对应 cluster-monitor:tabpanel:<key> 可见、上一个面板不再挂载
5. 直接打开 ?tab=scheduler：核对 scheduler 被选中并可见；再打开 ?tab=bogus：核对回退 overview 且不因非法值报错
6. 切到 resource 后刷新页面，核对仍落在 resource（URL 即状态）；复制该 URL 到新标签打开也落在 resource
7. 统计页头控件：cluster-monitor:range:* 按钮组与 cluster-monitor:auto-refresh 各恰好出现一次；在任一页签面板内部再统计一遍，确认没有第二套时间窗/刷新
8. 用 page.route 记录各页签的数据源请求：打开页面后（只挂载 overview）核对没有物理资源 range 指标、组件指标与 nodes?type=rank 请求；点开 resource 后核对物理资源指标开始请求；点开 ranking 后核对 nodes?type=rank 开始请求
9. 核对 cluster-monitor:surface 的 data-ai-state 在就绪后不是 loading，取值属于 ready / empty / error

## 期望结果

- 五个页签齐全有序，默认地落在 overview；点选与深链都改变选中页签与可见面板，切页签后 URL 同步为 ?tab=<key>
- ?tab=resource（及 apiserver/scheduler/ranking）可直接进入对应页签；刷新/复制 URL 保持当前页签；?tab=bogus 被忽略并回退 overview
- 页签切换用 replace，不新增浏览器历史（后退/前进不承诺在页签间切换）
- 页头只有一套时间窗与自动刷新，页签面板内部没有重复控件
- 基础 5 页签 + 条件 etcd 页签（200 才有，404 隐藏且 ?tab=etcd 回退 overview）
- 未挂载的页签不发起自己的数据请求；挂载后才请求，且各页签请求互不替代
- 页面 surface 的 state 与当前页签主查询一致，就绪后不为 loading
- 节点详情等 node 变体（若当前 build 有入口）没有页签；本 build 无节点监控入口时在报告中登记未覆盖

## 失败排查

- 点页签地址栏不出现 ?tab=：route 的 useNavigate 没有把 search 写回（替换历史但必须同步 URL）
- 深链后仍落在 overview：validateSearch 未接受 tab，或组件没有用搜索参数初始化受控 value
- 未挂载页签就发请求：五个页签内容被同时渲染（只应渲染当前页签），或查询提升到了页面级
- 页签内又出现时间窗：页签组件自己渲染了控件，而不是复用页头

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:tab:<overview|resource|apiserver|scheduler|ranking> / cluster-monitor:tabpanel:<key> / cluster-monitor:range:* / cluster-monitor:auto-refresh / cluster-monitor:surface[data-ai-state]
