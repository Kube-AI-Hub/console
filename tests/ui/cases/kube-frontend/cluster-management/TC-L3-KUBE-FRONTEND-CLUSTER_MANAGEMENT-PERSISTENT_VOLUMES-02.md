# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02 持久卷列表 · 持久卷详情

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `persistent-volumes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/persistentvolumes`
- **需求**: `prd/kube-frontend/cluster-management/persistent-volumes.md`

## 产品功能

从持久卷列表点名称进入详情：状态、容量、访问模式、回收策略、存储类型、卷模式、挂载选项、创建时间与绑定声明；数据来自该卷对象。

### 关联需求

- `prd/kube-frontend/cluster-management/persistent-volumes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/persistent-volumes.md`](../../../../prd/kube-frontend/cluster-management/persistent-volumes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02** — 已知集群中有持久卷，当点击其名称，则进入持久卷详情：显示状态、容量、访问模式、回收策略、存储类型、卷模式、挂载选项、创建时间，以及绑定的声明（未绑定时明确说明）；这些值与该持久卷对象一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/persistent-volumes.md`](../../../../design/kube-frontend/cluster-management/persistent-volumes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/persistent-volumes.md`](../../../../prd/kube-frontend/cluster-management/persistent-volumes.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 弄清一个卷的数据会不会丢 (Priority: P1)

作为 **集群管理员**，我希望 **看到一个持久卷的回收策略与绑定关系**，以便 **在删除声明前知道数据是被保留还是被删除**。

**Independent Test**：从持久卷列表点进详情，核对回收策略、容量与绑定声明与该对象一致。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群至少有一个持久卷

## 测试步骤

1. 用 API 读取持久卷列表，取第一个卷的名称、回收策略、容量与绑定声明
2. 打开持久卷页，点击该卷名称
3. 核对详情页 URL 与各区块
4. 核对回收策略、容量、访问模式与对象一致
5. 核对绑定声明显示为 <namespace>/<name>

## 期望结果

- 详情页可达且状态 ready
- 回收策略、容量、访问模式、存储类型与对象一致
- 绑定的声明显示 namespace/name；未绑定时明确说明

## 失败排查

- 详情打不开：确认 $name 路由与列表链接参数一致
- 容量显示原始值：应经 quantity 格式化
- 绑定声明显示空：读取的是 spec.claimRef 而不是 status

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 PersistentVolumeDetailPage.tsx
