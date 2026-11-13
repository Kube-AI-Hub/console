# 节点用量（L3）

[子模块需求](./_index.md)

## 概述

按使用率排列的节点表：节点名、CPU 使用率、内存使用率、磁盘使用率、容器组数。默认最忙的排在最前，可切换排序键与升降序。

数据来自 KubeSphere 监控的**节点指标**（`node_cpu_utilisation` / `node_memory_utilisation` / `node_disk_size_utilisation` / `node_pod_running_count`）。这些值是 0–1 的**比例**，展示前必须乘 100。

## 用户故事

### US1 - 一眼看出哪台节点最忙 (Priority: P1)

作为 **集群管理员**，我希望 **节点按使用率从高到低排列**，以便 **不必在几十台节点里逐行对照数字**。

**Independent Test**：打开节点用量，核对首行的 CPU 使用率不小于其余任意一行。

### US2 - 换一个维度看排名 (Priority: P1)

作为 **集群管理员**，我希望 **按内存或磁盘排序**，以便 **回答「哪台节点快满了」而不只是 CPU**。

**Independent Test**：点击「内存使用率」列头，核对顺序变为内存降序；再点一次变为升序。

### US3 - 百分比要能被相信 (Priority: P2)

作为 **集群管理员**，我希望 **看到的是 0–100 的百分比而不是 0–1 的小数**，以便 **不会把「6%」读成「0.06%」**。

**Independent Test**：核对每一行的三个使用率都是 0–100 之间的整数百分比。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01** — 已知监控后端返回节点指标，当打开节点用量页，则列出集群的全部节点，每行显示 CPU、内存、磁盘使用率（0–100 的整数百分比）与容器组数；默认按 CPU 使用率降序，首行是该列最大值；节点行数与监控返回的节点数一致。

## 设计目标

1. 默认排序就是页面要回答的问题（最忙的在前）。
2. 三个使用率同时给出，避免「CPU 不高但磁盘满了」被忽略。
3. 百分比由比例换算，换算只发生在一处。

## 约束与边界

- 读 `/kapis/monitoring.kubesphere.io/v1alpha3/nodes`，一次请求取四个指标。
- 只读。
- 数据为当前值，不含历史（历史在「集群监控」页）。
- 指标不可用时显示空态与说明，不显示 0。

## UI 交互设计

- 表格列：节点、CPU 使用率、内存使用率、磁盘使用率、容器组数；窄屏依次折叠。
- 使用率为「进度条 + 数字」，数字与条同源；颜色不作为唯一信息通道。
- 列头可排序（名称 / CPU / 内存 / 磁盘 / 容器组）。

## 文案与校验

- 百分比取整；容器组为整数。
- 空态：暂无节点用量 + 一句原因。

## 边界情况

- 某指标缺失：显示「未知」而不是 0%，因为 0% 是一个事实陈述。
- 节点很多：一次请求取全量后在前端排序与搜索。

## 明确不做

- 节点详情与排空/污点操作（属节点页与运维操作）。
- 按项目聚合的用量排行（项目用量已在集群「项目」页）。
- 历史趋势（见「集群监控」）。

## 假设

- 监控接口返回 `{ results: [{ metric_name, data: { result: [{ metric: { node }, value }] } }] }`，值为 0–1 的比例。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01** — 一次请求取四个节点指标并按节点合并。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-02** — 比例乘 100 得到百分比，换算只在 mapper 里做一次。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-03** — 默认按 CPU 降序，列头可切换。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01** — 行数与监控节点数一致；首行 CPU 为最大值；所有使用率在 0–100 之间。
