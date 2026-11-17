# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01 浮动工具箱与资源消费页（B200 计量已启用）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `bill`
- **入口**: `{BASE_URL}/kube-frontend/`
- **需求**: `prd/kube-frontend/cluster-management/bill.md`

## 产品功能

任意页面右下角有可拖拽工具箱，位置持久；展开后 6 个入口可达（日志/事件/审计/资源消费/kubeconfig/kubectl）。资源消费页按项目展示时间窗内 CPU/内存/存储/GPU；计量未启用时明确说明而不是空表。

### 关联需求

- `prd/kube-frontend/cluster-management/bill.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/bill.md`](../../../../prd/kube-frontend/cluster-management/bill.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01** — 已知已登录，当打开任意控制台页面，则右下角可见工具箱悬浮球；点击展开 6 个入口，分别指向当前集群的 logs / events / audit-logs / bill / overview / kubectl；拖动超过阈值后位置写入 localStorage，刷新后保持，且拖动不会误触展开。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-02** — 已知集群启用计量，当打开资源消费页，则按项目显示 CPU（核）/内存/存储卷/GPU（卡）四列，行集合与计量接口返回的 namespace 一致、CPU 降序；切换时间窗重新查询；计量接口 404/5xx 时显示「本集群未启用计量组件」与重试，而不是空表；接口 200 但无数据时显示空态。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/bill.md`](../../../../design/kube-frontend/cluster-management/bill.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/bill.md`](../../../../prd/kube-frontend/cluster-management/bill.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在任何页面一键到达集群排障工具 (Priority: P2)

作为 **集群管理员**，我希望 **在任意页面打开一个可拖拽的工具箱，直接进入日志、事件、审计、资源消费、kubeconfig 与 kubectl**，以便 **不用记住每个工具在侧栏的哪一层**。

**Independent Test**：在工作台、资源列表、详情页分别打开工具箱，6 个入口都带当前集群段并到达对应页面；拖动后位置在刷新后保持。

### US2 - 按项目核对资源消费 (Priority: P2)

作为 **集群管理员**，我希望 **选择时间窗并按项目查看 CPU、内存、存储与 GPU 用量**，以便 **判断哪个项目在消耗资源**。

**Independent Test**：打开资源消费页，项目行与计量接口的 namespace 标签一致，CPU 降序；切换 1h/6h/24h 后重新查询；关闭计量组件的集群显示「本集群未启用计量组件」。

## 前置与配置

- 已登录 admin；集群 host 已启用 metering（实测 200）
- 用例不改动集群数据；拖拽位置在测试后复位/由浏览器上下文隔离

## 测试步骤

1. 打开工作台，确认工具箱悬浮球可见；点击展开，核对 6 个入口的 href 都带当前集群段
2. 点击「资源消费统计」进入账单页，核对表头 5 列且有项目行（命名空间来自计量返回）
3. 切换「近 6 小时」，表格仍就绪且请求带 start/end/step
4. 返回工作台，拖动悬浮球到新位置，核对 localStorage 记录；刷新后位置保持

## 期望结果

- 工具箱在所有页面可见；拖拽与点击互斥（拖动不展开）
- 6 个入口分别到 /clusters/<c>/{logs,events,audit-logs,bill,overview,kubectl}
- 账单页每个项目一行，CPU 降序；空窗口显示空态；计量 404/5xx 显示未启用说明 + 重试

## 失败排查

- 账单空表但接口 404：应显示「本集群未启用计量组件」而不是空态
- 拖拽后点击无效：pointerup 判断 moved，移动超过阈值不触发 toggle
- 项目行与 API 不一致：先核对 metric_name 映射与 namespace label

## 产品改版后如何更新自动化

- 句柄：toolbox:ball/panel/item:<key>；cluster-bill:surface/table/range:<1h|6h|24h>/empty/unavailable/retry/row:<ns>
