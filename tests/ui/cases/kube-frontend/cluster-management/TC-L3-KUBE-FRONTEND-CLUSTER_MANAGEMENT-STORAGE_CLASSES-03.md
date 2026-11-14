# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03 存储类型详情 · 关联存储卷

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `storage-classes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/storageclasses`
- **需求**: `prd/kube-frontend/cluster-management/storage-classes.md`

## 产品功能

存储类型详情的「关联存储卷」区块：列出 storageClassName 等于该类型的存储卷（名称/命名空间/状态/容量），名称为项目内存储卷详情链接；没有关联存储卷时给出空态。

### 关联需求

- `prd/kube-frontend/cluster-management/storage-classes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03** — 已知一个存储类型被若干存储卷使用，当打开该存储类型详情，则「关联存储卷」列出这些存储卷的名称、命名空间、状态与容量；行数等于 `storageClassName` 等于该类型的 PVC 数；名称链接到该卷所属项目内的存储卷详情；没有任何关联存储卷时给出明确说明。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/storage-classes.md`](../../../../design/kube-frontend/cluster-management/storage-classes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 判断一个存储类型的行为 (Priority: P1)

作为 **集群管理员**，我希望 **看到存储类型的绑定模式、回收策略与能力开关**，以便 **判断在它上面申请卷会得到什么行为**。

**Independent Test**：从列表点进存储类型详情，核对绑定模式与能力开关与该对象一致。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群至少有一个存储类型；该类型可能有或没有关联的存储卷

## 测试步骤

1. 用 API 读存储类型与全部存储卷，统计每个 storageClassName 的 PVC 数
2. 选 PVC 数最多的存储类型打开详情
3. 核对关联存储卷区块可见
4. 核对表头、行数与该类型 PVC 数一致、行句柄为 项目/名称
5. 核对名称链接含项目段与 persistentvolumeclaims/<name>
6. 若所选类型没有 PVC，则核对空态

## 期望结果

- sc-detail:pvcs 可见
- 有 PVC 时行数 = 该 storageClassName 的 PVC 数；表头含 名称/命名空间/状态/容量
- 名称链接形如 /kube-frontend/<workspace>/clusters/<cluster>/projects/<namespace>/persistentvolumeclaims/<name>
- 无 PVC 时 sc-detail:pvcs-empty 可见并说明「该存储类型还没有关联的存储卷」

## 失败排查

- 行数为 0 但有 PVC：过滤字段取错（应取 spec.storageClassName）
- 行数比实际多：没有按 storageClassName 过滤，或读了别的集群
- 名称链接 404：链接里漏了 workspace 段
- 区块一直加载：PVC 列表请求失败，检查 /kapis/.../persistentvolumeclaims

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 @/pages/cluster/StorageClassDetailPage.tsx；行句柄 data-ai-row=<namespace>/<name>
