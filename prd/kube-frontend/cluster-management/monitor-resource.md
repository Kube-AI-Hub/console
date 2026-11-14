# 应用资源监控（L3）

[子模块需求](./_index.md)

## 概述

集群 → 监控告警 → 应用资源监控：用两个页签回答「这个集群里 CPU / 内存主要被谁用掉」。按工作负载页签把同一 Deployment / StatefulSet / DaemonSet（以及没有控制器的裸容器组）的用量合并成一行；按容器组页签逐容器组列出；两个页签共用同一个时间范围选择器，默认按 CPU 降序，首屏即 Top 10。

数据来自 KubeSphere 监控的 range query（Pod 指标 + 一次性 ReplicaSet 归属映射），不读 metrics-server。

## 用户故事

### US1 - 在集群视角找出 CPU/内存占用最高的工作负载与容器组 (Priority: P1)

作为 **集群运维**，我希望 **在同一个页面按工作负载或按容器组查看一段时间内的 CPU、内存用量并排序**，以便 **定位是哪个项目的哪个负载/容器组把集群资源吃掉了，而不是逐个项目翻排行**。

**Independent Test**：打开应用资源监控页，核对两个页签都有排序表；切换时间范围后表重新出现；监控后端不可用时页面给出明确说明。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01** — 已知集群监控可用，当打开 `/kube-frontend/clusters/<cluster>/monitor-resource`，则显示「按工作负载 / 按容器组」两个页签且默认在按工作负载；有监控数据时两个页签各显示名称/项目/CPU 用量/内存用量四列且行数大于 0，切换页签与时间范围（1h/6h/24h/7d）后仍显示数据；已知监控后端不可用，则显示「监控指标不可用」说明而不是空表；已知监控可用但没有容器组指标，则显示「暂无资源用量数据」说明。

## 设计目标

- 两个视角共享同一时间窗与同一份 Pod 指标读取，切换页签不重复请求。
- 首屏按 CPU 降序，前十条就是最热的十个对象；可改按内存或名称排序。
- 监控不可用、无数据、有数据三种结果各自有明确页面状态，不把「没装监控」显示成「没有容器组」。

## 约束与边界

- 只读页面：不做任何写操作，也不提供下钻曲线（下钻回项目/容器的监控详情是后续改进）。
- 监控 API 没有集群级 workloads 集合：按工作负载的合并由页面完成（Pod 指标 + ReplicaSet → Deployment 归属映射）。
- 精确归属链：Deployment 的 Pod 在指标里标成 ReplicaSet，需要一次集群级 ReplicaSet 读取补上 Deployment 名称；StatefulSet / DaemonSet 已直接标注。
- 静态镜像 Pod（`owner_kind: Node`，如 kube-apiserver）不计入按工作负载，避免与节点视角重复；它们仍出现在按容器组页签。
- 每页 10 行；时间范围固定四档。

## UI 交互设计

标题与说明在上，时间范围按钮（最近 1 小时 / 6 小时 / 24 小时 / 7 天）在标题下方，页签栏在范围按钮下方，页签内容为排序表。

- 页签：按工作负载 / 按容器组；切换只换表，不重新取数。
- 表格列：名称（链接到项目控制台对应对象）、项目、CPU 用量、内存用量；默认 CPU 降序。
- 名称格下方的小字是对象类型（Deployment / StatefulSet / DaemonSet / Pod）。
- CPU 按核显示（小于 1 核显示毫核 `m`），内存按二进制单位（MiB / GiB / TiB）。
- 页面句柄：`cluster-resource-monitor:surface`、`cluster-resource-monitor:tab:workloads`、`cluster-resource-monitor:tab:pods`、`cluster-resource-monitor:range`、`cluster-resource-monitor:empty`；监控不可用说明为 `cluster-resource-monitor:unavailable`。

## 文案与校验

- 页签名：按工作负载、按容器组。
- 列名：名称、项目、CPU 用量、内存用量。
- 状态文案：监控不可用时「监控指标不可用」+ 说明 + 重试；无数据时「暂无资源用量数据」+ 说明。
- 时间范围复用集群监控的文案：最近 1 小时 / 6 小时 / 24 小时 / 7 天。

## 边界情况

- 监控后端请求失败（404/5xx/网络）：错误态显示「监控指标不可用」与重试按钮，不渲染空表。
- 监控返回 200 但没有任何 Pod 指标：空态显示「暂无资源用量数据」，说明可能是未安装监控或刚开始采集。
- 某工作负载只有一个 Pod 且该 Pod 没有归属信息：按 Pod 行计入，不丢弃。
- ReplicaSet 归属映射读取失败：按 ReplicaSet 名称成行（类型显示 ReplicaSet），页面不因此报错。
- 搜索无结果：表格显示通用空态，页面不进入监控不可用态。
- 页面在监控组件晚就绪时：重试按钮重新发起同一次 range query。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01** — 应用资源监控页提供「按工作负载 / 按容器组」两个页签，默认按工作负载。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-02** — 表格列出名称、项目、CPU 用量、内存用量，默认 CPU 降序，可分页排序搜索。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-03** — 时间范围可选 1h / 6h / 24h / 7d，每行为窗口内的平均用量。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-04** — 监控不可用与无数据分别给出明确说明，不显示空表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01** — 监控可用的集群上，两个页签首屏都能在 2 秒内给出排行（range query 一次 + ReplicaSet 一次）。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-02** — 监控不可用时，读者能从页面文字判断是「没装监控」而不是「没有容器组」。

## 明确不做

- 不做下钻曲线（工作负载/容器组的详细趋势回到项目监控页与容器监控页看）。
- 不做按项目过滤、导出 CSV（列表页的过滤/导出能力不在本功能点范围）。
- 不改动监控 API 的指标白名单，也不新增后端指标。
- 不把静态镜像 Pod 合并进工作负载排行（见约束）。

## 假设

- KubeSphere 监控组件已安装时，`/kapis/monitoring.kubesphere.io/v1alpha3/pods` 支持 `start@end`/`step` 的 range query，且标签含 `namespace/pod/owner_kind/owner_name`。
- 集群内 ReplicaSet 数量可一次性读取（实测 262 条）；项目数量增长不是本页的复杂度来源。
- 集群范围最多约数百个容器组，客户端排序与分页足够。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01`
