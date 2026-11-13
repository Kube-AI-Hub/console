# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02 存储类型详情 · 行为与驱动参数

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `storage-classes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/storageclasses`
- **需求**: `prd/kube-frontend/cluster-management/storage-classes.md`

## 产品功能

从存储类型列表点名称进入详情：供应者、回收策略、绑定模式、创建时间、扩容/克隆/快照能力与已绑定声明数，以及驱动参数。

### 关联需求

- `prd/kube-frontend/cluster-management/storage-classes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02** — 已知集群中有存储类型，当点击名称进入详情，则显示供应者、回收策略、绑定模式、创建时间、是否允许扩容/克隆/快照与已绑定声明数，并列出该驱动声明的参数（无参数时明确说明）；这些值与该存储类型对象一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/storage-classes.md`](../../../../design/kube-frontend/cluster-management/storage-classes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 判断一个存储类型的行为 (Priority: P1)

作为 **集群管理员**，我希望 **看到存储类型的绑定模式、回收策略与能力开关**，以便 **判断在它上面申请卷会得到什么行为**。

**Independent Test**：从列表点进存储类型详情，核对绑定模式与能力开关与该对象一致。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群至少有一个存储类型

## 测试步骤

1. 用 API 读取存储类型列表，取第一个的名称、供应者、回收策略与绑定模式
2. 打开存储类型列表，点击该名称
3. 核对 URL 与基本信息
4. 核对驱动参数区（有参数时列出，无参数时说明）

## 期望结果

- 详情页可达且 ready
- 供应者、回收策略、绑定模式与对象一致
- 能力开关显示为「是/否」

## 失败排查

- 显示原始 key：新增文案后未重新构建前端包
- 参数区为空但对象有 parameters：读取的是列表行而非对象
- 绑定模式显示空：字段在 spec 顶层而不是 parameters 里

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 StorageClassDetailPage.tsx
