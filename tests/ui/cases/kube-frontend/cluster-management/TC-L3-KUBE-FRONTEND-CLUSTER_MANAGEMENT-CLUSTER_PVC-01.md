# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01 集群级存储卷声明 · 跨项目列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-pvc`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/cluster-management/cluster-pvc.md`

## 产品功能

集群级存储卷声明的跨项目只读列表：名称（链接）、项目、状态、容量、访问模式、存储类型、创建时间；服务端关键字搜索与每页 20 条分页。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-pvc.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pvc.md`](../../../../prd/kube-frontend/cluster-management/cluster-pvc.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01** — 已知集群里有存储卷声明，当打开集群级存储卷页，则列出名称（链接到该对象所属项目内的 PVC 详情）、项目、状态、容量、访问模式、存储类型与创建时间；每页行数等于 `min(20, total)`；项目列等于对象命名空间；名称链接形如 `/kube-frontend/<workspace>/clusters/<cluster>/projects/<namespace>/persistentvolumeclaims/<name>`；按名称的服务端搜索可用，分页每页 20 条。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-pvc.md`](../../../../design/kube-frontend/cluster-management/cluster-pvc.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pvc.md`](../../../../prd/kube-frontend/cluster-management/cluster-pvc.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目定位一张存储卷 (Priority: P1)

作为 **集群管理员**，我希望 **不进入具体项目就按名称检索集群里的存储卷声明**，以便 **先确认它属于哪个项目、处于什么状态，再跳到该项目处理扩容或删除**。

**Independent Test**：打开集群级存储卷页，核对行数等于 `min(20, total)`、项目列等于对象命名空间、名称链接含 `/projects/<namespace>/persistentvolumeclaims/<name>`；输入一个唯一名称后行数收敛到 1。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群里至少有一个存储卷声明

## 测试步骤

1. 用 API 读跨项目存储卷声明首页（page=1, limit=20）
2. 打开集群级存储卷页
3. 核对表头与行数
4. 逐行核对项目列与名称链接
5. 输入一个唯一名称，核对搜索发往服务端且收敛到该行

## 期望结果

- 行数等于 min(20,total)
- 表头包含 名称/项目/状态/容量/访问模式/存储类型/创建时间
- 项目列等于对象命名空间
- 名称链接含 /projects/<namespace>/persistentvolumeclaims/<name>，且带 workspace 段
- 搜索请求带 name= 参数，结果包含该对象

## 失败排查

- 行数为 0：请求带了 namespace 段
- 表头缺列：页面把项目级 schema 直接复用而未替换列
- 搜索不收敛：关键词没有传给服务端（前端过滤当前页）
- 名称链接 404：链接里漏了 workspace 段

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 @/pages/cluster/ClusterPersistentVolumeClaimsPage.tsx；行句柄是 namespace/name
