# 资源消费（账单）与浮动工具箱（L3）

[子模块需求](./_index.md)

## 概述

- **浮动工具箱**：任意页面右下角的悬浮球，展开 6 个集群工具入口（日志查询 / 事件检索 / 审计检索 / 资源消费统计 / kubeconfig / kubectl），可拖拽、位置持久。
- **资源消费页**：/kube-frontend/clusters/<cluster>/bill，按项目展示时间窗内的 CPU、内存、存储卷与 GPU 使用量；计量未启用时如实说明，不显示空表。

来源：2026-11-17 产品复核重纳 N-03（老 console 的 KubeTools 悬浮球与 /bill 页面）。

## 用户故事

### US1 - 在任何页面一键到达集群排障工具 (Priority: P2)

作为 **集群管理员**，我希望 **在任意页面打开一个可拖拽的工具箱，直接进入日志、事件、审计、资源消费、kubeconfig 与 kubectl**，以便 **不用记住每个工具在侧栏的哪一层**。

**Independent Test**：在工作台、资源列表、详情页分别打开工具箱，6 个入口都带当前集群段并到达对应页面；拖动后位置在刷新后保持。

### US2 - 按项目核对资源消费 (Priority: P2)

作为 **集群管理员**，我希望 **选择时间窗并按项目查看 CPU、内存、存储与 GPU 用量**，以便 **判断哪个项目在消耗资源**。

**Independent Test**：打开资源消费页，项目行与计量接口的 namespace 标签一致，CPU 降序；切换 1h/6h/24h 后重新查询；关闭计量组件的集群显示「本集群未启用计量组件」。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01** — 已知已登录，当打开任意控制台页面，则右下角可见工具箱悬浮球；点击展开 6 个入口，分别指向当前集群的 logs / events / audit-logs / bill / overview / kubectl；拖动超过阈值后位置写入 localStorage，刷新后保持，且拖动不会误触展开。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-02** — 已知集群启用计量，当打开资源消费页，则按项目显示 CPU（核）/内存/存储卷/GPU（卡）四列，行集合与计量接口返回的 namespace 一致、CPU 降序；切换时间窗重新查询；计量接口 404/5xx 时显示「本集群未启用计量组件」与重试，而不是空表；接口 200 但无数据时显示空态。

## 设计目标

- 工具箱不侵入页面布局，且一次移动长期有效。
- 「没有数据」与「没有计量」必须可区分。

## 约束与边界

- 工具入口都是集群作用域：从 URL 取当前集群；平台/工作台页取最近进入的集群，再回退默认集群。
- 计量查询 GET /kapis/metering.kubesphere.io/v1alpha1/namespaces?start=&end=&step=5m；成员集群按 /kapis/clusters/<c>/… 约定。
- 统计窗口：CPU/内存/GPU 取窗口内均值，存储卷取最新值；金额字段当前全部为 0，本页不展示费用。
- 工具箱位置存 localStorage['kube-frontend:toolbox']，只影响本浏览器。

## UI 交互设计

- 悬浮球 44px，右下角默认；面板在其上方，6 行文本入口。
- 拖拽：指针移动超过 3px 视为拖动，只更新位置并在抬起时持久化；未移动则在抬起时展开/收起；再次点击悬浮球收起，选择入口后自动收起。
- 资源消费页：标题/描述 + 时间窗切换（近 1/6/24 小时）+ 表格（项目、CPU、内存、存储卷、GPU）；窗口说明写明均值/最新值口径。
- data-ai-id：toolbox:ball、toolbox:panel、toolbox:item:<key>；cluster-bill:surface、:table、:row:<ns>、:range:<1h|6h|24h>、:empty、:unavailable、:retry。

## 文案与校验

- 工具箱：标题「集群工具」，入口名与侧栏一致；悬浮球 aria-label「工具箱」。
- 资源消费：空态「当前时间窗内没有项目用量数据。」；未启用「本集群未启用计量组件」+ 原因 + 重试。
- 数值：CPU/GPU 两位小数；内存/存储按 1024 进位到 KiB/MiB/GiB/TiB。

## 边界情况

- 计量接口 404（路由未注册）、400/501（模块未挂载）或 5xx ⇒ 未启用/不可用说明；403 仍是错误面板，不能伪装成未启用。
- 接口 200 但 results 为空 ⇒ 空态。
- 最近集群不存在（首次访问工作台）⇒ 入口回退到 host；换集群后从 URL 立即切换。
- localStorage 不可写 ⇒ 位置只在本次会话生效，不报错。

## 明确不做

- 账单导出、按费用/价格计算、工作空间级/集群级汇总切换（老页面有更细的层级，本批先交付项目级）。
- 工具箱的自定义工具、快捷键、移动端专用布局。
- 计量的保留期/精度设置。

## 假设

- 计量的 namespace 级别指标名稳定（meter_namespace_{cpu_usage,memory_usage_wo_cache,pvc_bytes_total,gpu_usage}）。
- 工具箱入口对应的 6 个页面在其他批次已交付（logs/events/audit-logs/overview/kubectl/bill）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01** — 全站浮动工具箱，6 个入口，可拖拽且位置持久。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-02** — 资源消费页按项目展示窗口内用量，区分未启用与空数据。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01** — 6 个入口 href 均含当前集群段；拖动后 localStorage 有记录且刷新位置一致。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-02** — 表格行集合 = 计量返回的 namespace 集合；各列数值与对应 metric 的聚合一致。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01
