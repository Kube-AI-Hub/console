# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01 集群列表 · 平台入口与就绪状态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-list`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/cluster-list.md`

## 产品功能

平台级集群列表：名称（副行供应者）、状态徽标（未就绪时带原因）、Kubernetes 版本、节点数、创建时间；名称链接进入该集群概览。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01** — 已知平台注册了若干集群，当打开 `/kube-frontend/clusters`，则列出全部集群；每行显示名称（副行为供应者）、状态徽标、Kubernetes 版本、节点数与创建时间；行数等于 `clusters` 接口返回数；名称链接指向该集群的概览页；未就绪的集群显示条件消息。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-list.md`](../../../../design/kube-frontend/cluster-management/cluster-list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 找到要进的集群 (Priority: P1)

作为 **平台管理员**，我希望 **在一个列表里看到所有集群**，以便 **直接点进要操作的那个，而不是先猜集群名拼地址**。

**Independent Test**：打开集群列表，核对行数与接口返回的集群对象数一致，且每行名称是指向 `/kube-frontend/clusters/<name>/overview` 的链接。

### US2 - 看出哪个集群不健康 (Priority: P1)

作为 **平台管理员**，我希望能 **直接看到就绪状态与不健康的原因**，以便 **不必进入每个集群才能发现某个集群掉线**。

**Independent Test**：核对就绪徽标与集群对象 `Ready` 条件一致；未就绪时同一行显示条件消息。

## 前置与配置

- 已登录，且是平台管理员
- 平台注册了至少一个集群

## 测试步骤

1. 用 API 读取 clusters 集合，记下集群数、其中一个集群的名称与 Ready 条件
2. 打开 /kube-frontend/clusters，等待 surface 就绪
3. 核对表头与行数
4. 核对首行名称链接指向 /kube-frontend/clusters/<name>/overview
5. 点进链接，核对进入该集群的概览页

## 期望结果

- 平台入口 /kube-frontend/clusters 渲染集群集合：列依次为 名称、状态、Kubernetes 版本、节点数、创建时间
- 行数等于集群接口返回的数量；就绪集群显示「运行正常」
- 集群名链接指向 /kube-frontend/clusters/<名称>/overview，点击后概览页就绪
- 不存在的集群 id 显示「资源不存在」与「重试」，页签仍在
- 行数等于接口返回的集群数
- 表头包含 名称、状态、Kubernetes 版本、节点数、创建时间
- 就绪徽标与 Ready 条件一致；未就绪时同一行显示条件消息
- 名称链接可达概览页

## 失败排查

- 页面 404：确认路由是 /kube-frontend/clusters（无集群段），不是 /clusters/host
- 行数偏少：接口没返回全部集群
- 状态与接口不一致：就绪只认 Ready 条件为 True

## 产品改版后如何更新自动化

- 列或标识变化时改 pages/cluster_management.py 与 MultiClusterListPage.tsx
