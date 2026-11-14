# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01 IP 池 · 列表用量与详情的工作空间分配

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `ip-pools`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/ippools`
- **需求**: `prd/kube-frontend/cluster-management/ip-pools.md`

## 产品功能

集群 IP 池列表显示网段与已用 IP；没有池时给出空态说明；详情显示网段、可用范围与按工作空间汇总的分配数。

### 关联需求

- `prd/kube-frontend/cluster-management/ip-pools.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/ip-pools.md`](../../../../prd/kube-frontend/cluster-management/ip-pools.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01** — 当打开集群 IP 池页，则列出集群内全部 `ippools.network.kubesphere.io`，每行显示网段与已用 IP，默认池带「默认」徽标。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-02** — 当集群没有 IP 池，则显示空态说明「容器组直接从节点网络取地址」，不是空白表格。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-03** — 当打开某个池的详情，则显示网段、可用地址范围与按工作空间汇总的分配数。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/ip-pools.md`](../../../../design/kube-frontend/cluster-management/ip-pools.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/ip-pools.md`](../../../../prd/kube-frontend/cluster-management/ip-pools.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清 IP 段被谁用掉了 (Priority: P1)

作为 **平台运维**，我希望 **在集群视角看到每个 Pod IP 池的用量与归属**，以便 **判断某个网段还有多少余量、能不能交给新的企业空间**。

**Independent Test**：打开 IP 池列表，能看到每个池的网段、已用/总量、归属工作空间；点进详情能按工作空间看到用量明细，并看到使用该池的容器组。

## 前置与配置

- 已登录平台管理
- 集群已安装网络插件（ippools 接口可读）

## 测试步骤

1. 打开集群 IP 池页，确认标题、描述与列
2. 若集群有池：核对每行网段与已用 IP
3. 若无池：确认空态说明指向「容器组直接从节点网络取地址」
4. 打开第一个池的详情，核对基本信息与工作空间用量区

## 期望结果

- 列表渲染（有数据或空态），不出现 0/0
- 空态文案说明原因
- 详情显示网段与工作空间分配数；pod 区显示列表或空态

## 失败排查

- 接口 404：集群未装网络插件，页面应显示错误与重试而不是空态
- 容量缺失显示 0/0：status.capacity 未同步，应退回只显示已用

## 产品改版后如何更新自动化

- 列变化时同步 IpPoolsPage 的 schema 与用例断言
