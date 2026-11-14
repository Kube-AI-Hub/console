# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01 集群级工作负载 · 跨项目列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-workloads`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/deployments`
- **需求**: `prd/kube-frontend/cluster-management/cluster-workloads.md`

## 产品功能

七类工作负载的集群级跨项目列表：名称（链接）、项目、状态、就绪、镜像、创建时间。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-workloads.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-workloads.md`](../../../../prd/kube-frontend/cluster-management/cluster-workloads.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01** — 已知集群里有部署、服务等工作负载，当打开对应集群级页面，则列出名称、项目、状态、就绪数（有副本概念的类型）、镜像与创建时间；每页行数等于 `min(20, total)`；名称链接指向该对象所属项目内的详情页（URL 含 workspace 段与项目段）；七类页面（deployments/statefulsets/daemonsets/jobs/cronjobs/services/ingresses）都从侧栏「工作负载」分组可达。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-workloads.md`](../../../../design/kube-frontend/cluster-management/cluster-workloads.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-workloads.md`](../../../../prd/kube-frontend/cluster-management/cluster-workloads.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目盘点工作负载 (Priority: P1)

作为 **集群管理员**，我希望 **在不知道项目的情况下按类型盘点工作负载**，以便 **先找到对象，再进到它所属的项目处理**。

**Independent Test**：打开集群级部署页，核对行数等于接口首页条数、项目列等于对象命名空间、名称链接含 workspace 与项目段。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群里至少有一个部署

## 测试步骤

1. 用 API 读跨项目部署首页（page=1, limit=20）
2. 打开集群级部署页
3. 核对行数与表头
4. 核对项目列与名称链接
5. 核对侧栏「工作负载」分组可达

## 期望结果

- 行数等于 min(20,total)
- 表头包含 名称/项目/状态
- 名称链接含 workspace 与项目段

## 失败排查

- 行数为 0：带了 namespace 段
- 侧栏缺失：registry path 含 /（契约会拒绝）
- 英文界面报缺键：只加了中文词典

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterWorkloadsPage.tsx
