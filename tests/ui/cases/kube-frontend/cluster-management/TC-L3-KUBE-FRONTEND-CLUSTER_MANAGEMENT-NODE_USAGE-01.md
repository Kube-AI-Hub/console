# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01 节点用量 · 默认按 CPU 降序与百分比换算

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `node-usage`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/node-usage`
- **需求**: `prd/kube-frontend/cluster-management/node-usage.md`

## 产品功能

节点用量页服务端分页展示九类排行指标及容器组数，直接进入默认 CPU 降序；比率乘100，load1 不换算，GPU 分配按卡数排序但展示分配率。

### 关联需求

- `prd/kube-frontend/cluster-management/node-usage.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/node-usage.md`](../../../../prd/kube-frontend/cluster-management/node-usage.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01** — 已知监控后端返回节点指标，当打开节点用量页，则服务端分页展示九类指标及容器组数，支持搜索、每页档位、刷新及指标排序。直接进入默认 CPU 降序，概览下钻携带已选指标；行数与同次排行响应的当前页一致，总数取 total_item。使用率乘100，load1 为原始负载，GPU 分配按卡数排序/按分配率展示，缺值显示 -，名称和 IP/控制面标记可下钻节点详情。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/node-usage.md`](../../../../design/kube-frontend/cluster-management/node-usage.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/node-usage.md`](../../../../prd/kube-frontend/cluster-management/node-usage.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪台节点最忙 (Priority: P1)

作为 **集群管理员**，我希望 **节点按使用率从高到低排列**，以便 **不必在几十台节点里逐行对照数字**。

**Independent Test**：打开节点用量，核对首行的 CPU 使用率不小于其余任意一行。

### US2 - 换一个维度看排名 (Priority: P1)

作为 **集群管理员**，我希望 **按内存或磁盘排序**，以便 **回答「哪台节点快满了」而不只是 CPU**。

**Independent Test**：点击「内存使用率」列头，核对顺序变为内存降序；再点一次变为升序。

### US3 - 百分比要能被相信 (Priority: P2)

作为 **集群管理员**，我希望 **看到的是 0–100 的百分比而不是 0–1 的小数**，以便 **不会把「6%」读成「0.06%」**。

**Independent Test**：核对每一行的三个使用率都是 0–100 之间的整数百分比。

## 前置与配置

- 已登录，且对集群 host 有读取权限
- 监控后端返回节点指标

## 测试步骤

1. 捕获页面同次 type=rank 响应，记下当前页节点与 CPU 比例
2. 打开节点用量页，等待 surface 就绪
3. 核对行数与当前页一致，总数来自 total_item
4. 读取每行的三个使用率，核对都是 0-100 的整数
5. 核对首行 CPU 使用率等于接口算出的最大值（乘 100 后取整）

## 期望结果

- 行数与同次服务端当前页一致
- 所有使用率为 0-100 的整数百分比（出现 0% 而接口为 0.6 说明没乘 100，出现 61% 而接口为 0.6 说明乘对了）
- 首行是 CPU 最高的节点

## 失败排查

- 全部显示 0%：比例没有乘 100
- 出现大于 100：把容器组数也当比例乘了 100
- 行数与当前页不一致：检查 type=rank、page/limit 和按 node 身份合并
- 排序不对：默认 sort_metric=node_cpu_utilisation、sort_type=desc

## 产品改版后如何更新自动化

- 列或标识变化时改 pages/cluster_management.py 与 NodeUsagePage.tsx
