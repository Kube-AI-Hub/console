# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03 节点列表 · 节点详情（条件、容量、标签与污点）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

从节点列表点名称进入节点详情：状态、角色、版本、内网 IP、系统信息、可分配/总量（换算单位）、状态条件、标签与污点；数据来自该节点对象。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03** — 已知节点列表中有节点，当点击节点名称，则进入节点详情：显示状态、角色、kubelet 版本、内网 IP、操作系统镜像、内核、容器运行时与创建时间；「可分配 / 总量」按人类可读单位显示（CPU 为核、内存与存储为 GiB/TiB）；并列出全部状态条件、标签与污点；这些值与该节点对象一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 弄清某个节点为什么不健康 (Priority: P1)

作为 **集群管理员**，我希望 **点开一个节点看到它的状态条件、可分配量与污点**，以便 **判断它为什么不可用、还能不能再调度上去**。

**Independent Test**：从列表点进节点详情，核对条件数、可分配量与节点对象一致。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群至少有一个节点

## 测试步骤

1. 用 API 读取节点列表，取第一个节点的名称与 status.conditions 条数
2. 打开节点页，点击该节点名称
3. 核对 URL 与详情各区块
4. 核对「可分配 / 总量」为人类可读单位（不含 Ki/m 等原始后缀）
5. 核对条件条目数等于对象中的 conditions 数

## 期望结果

- 详情页可达且状态为 ready
- 基本信息与节点对象一致（状态、版本、内网 IP）
- 容量显示为核 / GiB·TiB / 整数，而不是原始 quantity 字符串
- 每个状态条件都有条目

## 失败排查

- 显示 255600m 之类原始值：容量未换算
- 条件为空：读取的不是 node.status.conditions
- 点名称无跳转：列表名称未接详情链接

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 NodeDetailPage.tsx
