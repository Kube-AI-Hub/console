# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01 仪表板面板渲染

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `dashboard-panels`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/custom-monitoring`
- **需求**: `prd/kube-frontend/cluster-management/dashboard-panels.md`

## 产品功能

打开自定义监控仪表板即可看到 row 标题、singlestat 数值与 graph 曲线；坏表达式只影响该面板。

### 关联需求

- `prd/kube-frontend/cluster-management/dashboard-panels.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/dashboard-panels.md`](../../../../prd/kube-frontend/cluster-management/dashboard-panels.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01** — 已知某集群仪表板的 `spec.panels` 含 `row`、`singlestat`、`graph` 三种面板，当从自定义监控列表点进该仪表板，则按顺序渲染：`row` 渲染为分区标题（不查询数据），`singlestat` 执行一次即时查询并以 `decimals` 决定小数位（`format` 含 bytes 时按 B/KiB/MiB/GiB 显示），`graph` 对每个 `targets[].expr` 执行范围查询并绘制曲线；切换时间窗（1h/6h/24h/7d）以新的起止与步长重取；某面板表达式无数据时显示「当前时间窗内没有数据」，查询失败时显示该面板自己的错误说明（**不影响其它面板**）；没有面板的仪表板显示「该仪表板还没有面板」；页面注明面板为只读渲染。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/dashboard-panels.md`](../../../../design/kube-frontend/cluster-management/dashboard-panels.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/dashboard-panels.md`](../../../../prd/kube-frontend/cluster-management/dashboard-panels.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开仪表板就看到面板数据 (Priority: P1)

作为 **集群运维**，我希望 **点开自定义监控仪表板就能看到它声明的每个面板的当前值或趋势**，以便 **不必把 PromQL 抄到别处执行才能知道集群状态**。

**Independent Test**：用一个只含 `sum(up)` 面板的仪表板打开面板页，`singlestat` 显示数值、`graph` 画出曲线；把表达式改成不存在的指标，则该面板显示「查询失败/没有数据」而不是空白。

## 前置与配置

- 已登录且有集群监控读权限
- host 集群 Prometheus 可经 apiserver service proxy 查询

## 测试步骤

1. 自建一个含 row / singlestat(sum(up)) / graph(sum(up)) / 坏表达式面板的仪表板
2. 从列表点进该仪表板
3. 读取 row 标题、singlestat 数值、graph 曲线与坏面板的提示
4. 切换时间窗到 24 小时
5. 清理仪表板

## 期望结果

- 面板只读，页面注明编辑不在迁移范围

## 失败排查

- 全部面板都空：求值走了 metrics_filter 而不是 Prometheus proxy
- 一个坏面板导致整页空白：没有按面板隔离错误

## 产品改版后如何更新自动化

- 选择器：dashboard-panels:surface / :title / :readonly-note / :panel:<i> / :panel:<i>:value / :chart / :empty / :error / :range:24h
