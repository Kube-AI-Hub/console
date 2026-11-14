# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01 应用资源监控 · 工作负载与容器组两个页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `monitor-resource`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/monitor-resource`
- **需求**: `prd/kube-frontend/cluster-management/monitor-resource.md`

## 产品功能

集群级「应用资源监控」用两个页签分别按工作负载、按容器组列出 CPU 与内存用量，默认 CPU 降序（首屏 Top 10），时间范围可选 1h/6h/24h/7d；监控不可用与没有数据时给出明确说明而不是空表。

### 关联需求

- `prd/kube-frontend/cluster-management/monitor-resource.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/monitor-resource.md`](../../../../prd/kube-frontend/cluster-management/monitor-resource.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01** — 已知集群监控可用，当打开 `/kube-frontend/clusters/<cluster>/monitor-resource`，则显示「按工作负载 / 按容器组」两个页签且默认在按工作负载；有监控数据时两个页签各显示名称/项目/CPU 用量/内存用量四列且行数大于 0，切换页签与时间范围（1h/6h/24h/7d）后仍显示数据；已知监控后端不可用，则显示「监控指标不可用」说明而不是空表；已知监控可用但没有容器组指标，则显示「暂无资源用量数据」说明。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/monitor-resource.md`](../../../../design/kube-frontend/cluster-management/monitor-resource.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/monitor-resource.md`](../../../../prd/kube-frontend/cluster-management/monitor-resource.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群视角找出 CPU/内存占用最高的工作负载与容器组 (Priority: P1)

作为 **集群运维**，我希望 **在同一个页面按工作负载或按容器组查看一段时间内的 CPU、内存用量并排序**，以便 **定位是哪个项目的哪个负载/容器组把集群资源吃掉了，而不是逐个项目翻排行**。

**Independent Test**：打开应用资源监控页，核对两个页签都有排序表；切换时间范围后表重新出现；监控后端不可用时页面给出明确说明。

## 前置与配置

- 已登录，且是 host 集群的集群管理员（集群级页面，无 workspace / 项目段）
- 用例先用 BFF 探测 /kapis/monitoring.kubesphere.io/v1alpha3/pods 的 range query 是否有数据

## 测试步骤

1. 探测监控 range query 是否返回容器组指标
2. 打开 /kube-frontend/clusters/<cluster>/monitor-resource，等待主区离开 loading
3. 读取默认「按工作负载」页签的表头、行数与时间范围按钮
4. 点「按容器组」页签，读取表头与行数
5. 点「最近 24 小时」，等待重新取数后再次核对行数

## 期望结果

- 默认页签为「按工作负载」，另一个页签的容器在切换前不存在
- 有监控数据时：两个页签表头都含 名称 / 项目 / CPU 用量 / 内存用量，行数大于 0；切换范围后行数仍大于 0
- 时间范围按钮为 1h / 6h / 24h / 7d，当前范围带 aria-pressed
- 监控不可用：页面显示「监控指标不可用」说明与重试，不渲染表格
- 监控可用但没有容器组指标：页面显示「暂无资源用量数据」说明，不渲染表格

## 失败排查

- 页面显示监控不可用：确认 KubeSphere 监控组件已安装，且 range query 的 step 是带单位的时长（如 5m）
- 行数一直是 0：确认 metrics_filter 里的 $ 与 | 已正确编码，以及集群里确实有容器组
- 按工作负载名称显示成带哈希后缀的 ReplicaSet：ReplicaSet 归属映射读取失败，检查 /apis/apps/v1/replicasets 可读

## 产品改版后如何更新自动化

- 列变化时改页面 schema 与用例里的表头常量
- 指标名或范围档位变化时同步改 resourceMonitorQueries.ts 与用例的探测参数
