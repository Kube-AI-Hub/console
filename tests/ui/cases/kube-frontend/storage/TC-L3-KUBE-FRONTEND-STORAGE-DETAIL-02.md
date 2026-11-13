# TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-02 存储详情 · 状态与供应者

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/csghub/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/detail.md`

## 产品功能

存储卷详情的属性含状态与供应者，且状态以中文呈现，与列表一致。

### 关联需求

- `prd/kube-frontend/storage/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/detail.md`](../../../../prd/kube-frontend/storage/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL-02** — 已知打开一个存储卷的详情，则属性含「状态」与「供应者」，且状态值以中文呈现（已绑定/等待中/已丢失/扩容中），与列表用词一致。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/detail.md`](../../../../design/kube-frontend/storage/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/detail.md`](../../../../prd/kube-frontend/storage/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在存储详情上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 由夹具创建一个 tc-e2e- 存储卷，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该存储卷详情
2. 读取属性名与状态值

## 期望结果

- 属性名含 状态 与 供应者
- 状态值为中文（已绑定/等待中/已丢失），与列表用的词一致

## 失败排查

- 缺少属性时看 toStorageDetail 与 StorageDetailPage 是否同步
- 状态显示英文说明 statusKey 未覆盖该值

## 产品改版后如何更新自动化

- 属性变化时改 prd/design 的字段表
