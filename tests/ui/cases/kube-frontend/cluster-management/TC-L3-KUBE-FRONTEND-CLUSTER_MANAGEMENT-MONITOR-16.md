# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16 集群监控 · 资源用量排行页签与 JSON 导出

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor`
- **入口**: `{{BASE_URL}}/kube-frontend/clusters/host/monitor`
- **需求**: `prd/kube-frontend/cluster-management/monitor.md`

## 产品功能

资源用量排行页签复用 NodeRankingPanel（aiIdPrefix=cluster-monitor:ranking:），显示节点数排行并可导出当前 metric/order 的全量行为 JSON 文件 node.usage.rank.json（{cluster, metric, order, generatedAt, items:[{name, values}]}）；无数据时导出按钮禁用并提示「没有可导出的数据」；node-usage 页同时获得同款导出。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16** — 已知集群就绪，当打开「资源用量排行」页签，则页签内容为节点用量排行表（复用 NodeRankingPanel，`aiIdPrefix="cluster-monitor:ranking:"`，保留名称/指标值/排序/搜索/分页，行与控件句柄以 `cluster-monitor:ranking:` 为前缀），页签标题与说明取既有 `cluster.nodeUsage.*` 文案；排行表右上角有导出按钮 `cluster-monitor:ranking:export`（文案 `cluster.nodeUsage.export`，title/hint `cluster.nodeUsage.exportHint`）；有数据时点击导出下载名为 `node.usage.rank.json` 的 JSON 文件，内容为 `{cluster, metric, order, generatedAt, items:[{name, values}]}`，items 为当前指标与排序下的全部行（`nodeRankingApi` 支持一次全量时用 `pageSize=-1`，不支持时逐页拉取；若后端只能给出已加载页，则导出已加载行并在文件中如实标注范围），不包含当前页以外的筛选缺失或伪造行；当前指标/排序无数据时导出按钮为禁用态并显示 `cluster.nodeUsage.exportEmpty` 提示，不生成空文件；节点用量排行独立页 `node-usage` 同时提供同款导出（句柄 `node-usage:export`），两处导出内容形状一致；切换排行页签不触发其它页签查询，导出失败（如接口 403/5xx）显示错误说明而不下载残缺文件。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor.md`](../../../../design/kube-frontend/cluster-management/monitor.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor.md`](../../../../prd/kube-frontend/cluster-management/monitor.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 按使用场景进入五个页签并可直接深链 (Priority: P1)

作为 **集群管理员**，我希望 **打开监控后按场景在概览、物理资源、API Server、调度器、资源用量排行五个基础页签之间切换（etcd 接入监控时另有条件 etcd 页签），并能把某个页签直接存成链接**，以便 **在排查控制面变慢、磁盘 IO、RDMA 或资源排行时不用在一屏长页面里滚动寻找，刷新或分享后也不会丢失当前场景**。

**Independent Test**：打开监控默认在概览；点「调度器监控」后只显示调度器图表，地址栏出现 `?tab=scheduler`，刷新后仍停在调度器；五个页签都能通过 `?tab=` 直接打开；切页签不触发其它页签的查询；节点详情复用该页面时没有页签条。

## 前置与配置

- 已登录 admin，集群 host 已就绪，节点排名接口可读
- 集群至少有一个节点（无节点时导出禁用分支另做，见步骤）

## 测试步骤

1. 用 API 读 nodes?type=rank 当前 metric/order 的全量行
2. 打开 /kube-frontend/clusters/host/monitor?tab=ranking，等待 ranking surface 就绪
3. 核对表格行与 API 行数/顺序一致（默认 metric 与 order），每行 node 名可见
4. 点导出按钮 cluster-monitor:ranking:export：核对下载文件名为 node.usage.rank.json，读取 JSON 并核对 {cluster, metric, order, generatedAt, items} 字段齐全
5. 核对导出 items 覆盖 API 全量行（不是当前页），每项有 name 与 values；对同一节点的同一指标值与 API 数值一致
6. 切换 metric（如 node_memory_utilisation）与排序：核对表格按新指标刷新，导出 JSON 的 metric/order/items 随之变化
7. 用 page.route 让 nodes?type=rank 返回 200 空结果（total_item=0, results=[]）：核对表格空态、导出按钮 disabled 且 title 为「没有可导出的数据」
8. 打开 /kube-frontend/clusters/host/node-usage，核对默认前缀 node-usage:export 存在且可点击（同一能力在独立页可用）

## 期望结果

- ranking 页签表格行数与顺序与 API 一致，页面无重复分页导致的行缺失
- 导出文件名 node.usage.rank.json，JSON 结构 {cluster, metric, order, generatedAt, items:[{name, values}]} 完整
- 导出为全量行而非当前页；数值与 API 一致；切换 metric/order 后导出内容跟随
- 空数据时按钮禁用并显示 exportEmpty 提示
- node-usage 页也有导出按钮（node-usage:export）

## 失败排查

- 导出只有一页：实现取了当前 pageSize 而不是全量（pageSize=-1 或逐页拉取）
- 下载文件名不对：a.download 写死或未设置
- 空数据仍可点导出：disabled 条件只看 loading 没看 rows.length
- ranking 页签行数与 node-usage 页不同：aiIdPrefix 改造时误改了查询参数

## 产品改版后如何更新自动化

- 句柄：cluster-monitor:ranking:surface / :ranking:export / :ranking:metric / :ranking:<metric>:<node> / node-usage:export
