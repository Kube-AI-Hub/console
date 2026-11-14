# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01 集群级容器组 · 跨项目列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-pods`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/pods`
- **需求**: `prd/kube-frontend/cluster-management/cluster-pods.md`

## 产品功能

集群级容器组列表：名称（链接到项目内详情）、项目、状态、节点、Pod IP、创建时间。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-pods.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pods.md`](../../../../prd/kube-frontend/cluster-management/cluster-pods.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01** — 已知集群有容器组，当打开集群级容器组页，则列出名称、项目、状态、所在节点、容器组 IP 与创建时间；每页行数等于 `min(20, total)`；名称链接指向该容器组所属项目内的 Pod 详情（URL 含 workspace 段）；按名称搜索时结果收窄。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-pods.md`](../../../../design/kube-frontend/cluster-management/cluster-pods.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pods.md`](../../../../prd/kube-frontend/cluster-management/cluster-pods.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群里此刻有哪些容器组 (Priority: P1)

作为 **集群管理员**，我希望 **跨项目查看容器组**，以便 **在不知道属于哪个项目时先找到它**。

**Independent Test**：打开集群级容器组页，核对行数等于接口首页条数，项目列等于对象所在命名空间，名称链接带正确 workspace 段。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群里至少有一个容器组

## 测试步骤

1. 用 API 读跨项目容器组首页（page=1, limit=20）
2. 打开集群级容器组页
3. 核对行数与表头
4. 核对项目列与名称链接

## 期望结果

- 行数等于 min(20, total)
- 表头包含 名称/项目/状态/所在节点/容器组 IP/创建时间
- 名称链接包含 workspace 段与项目段

## 失败排查

- 行数为 0：读了命名空间级集合（带了 namespace）
- 侧栏没有入口：registry path 必须是单段（不能是 workloads/pods）
- 链接落到 Not Found：workspace 段缺失或猜错

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterPodsPage.tsx
