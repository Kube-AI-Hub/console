# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01 存储类型 · 六列与能力标记

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `storage-classes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/storageclasses`
- **需求**: `prd/kube-frontend/cluster-management/storage-classes.md`

## 产品功能

存储类型列表显示六列；默认类型带徽标；能力列只列出实际支持的能力。

### 关联需求

- `prd/kube-frontend/cluster-management/storage-classes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01** — 已知集群有多个存储类型，当打开存储类型页，则显示名称、供应者、存储卷数、能力、回收策略、创建时间六列；标了默认的那一行带「默认」徽标；能力列只列出该类型实际支持的能力（不支持的不显示），且与 API 的 `allowVolumeExpansion` 等字段一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/storage-classes.md`](../../../../design/kube-frontend/cluster-management/storage-classes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/storage-classes.md`](../../../../prd/kube-frontend/cluster-management/storage-classes.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认某个存储类适合做什么 (Priority: P1)

作为 **集群管理员**，我希望 **看到供应者、回收策略与支持的能力**，以便 **判断新存储该选哪一类**。

**Independent Test**：打开存储类型页，核对默认类的徽标与各行的能力标记。

## 前置与配置

- 已登录，且有集群权限
- 集群内至少有一个存储类型

## 测试步骤

1. 用 API 读取存储类型及其 allowVolumeExpansion
2. 打开存储类型页，核对表头与行数
3. 核对默认类型的徽标
4. 核对不支持扩容的那一行能力列

## 期望结果

- 表头依次为 名称、供应者、存储卷数、能力、回收策略、创建时间
- 行数与 API 一致
- 默认类型行含「默认」徽标
- 不支持扩容的行不出现「扩容」徽标

## 失败排查

- 每行都显示三个能力说明渲染了全部徽标（应按支持与否渲染）
- 存储卷数为 0 而平台未上报时，应显示 - 而不是 0

## 产品改版后如何更新自动化

- 能力字段变化时改 api-client 的 toStorageClassSummary
