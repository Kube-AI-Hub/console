# TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01 存储 · 详情八项属性

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/detail.md`

## 产品功能

['详', '情', '按', '顺', '序', '显', '示', '集', '群', '、', '项', '目', '、', '存', '储', '类', '型', '、', '容', '量', '、', '访', '问', '模', '式', '、', '持', '久', '卷', '、', '创', '建', '时', '间', '、', '创', '建', '者', '。']

### 关联需求

- `prd/kube-frontend/storage/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/detail.md`](../../../../prd/kube-frontend/storage/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/detail.md`](../../../../design/kube-frontend/storage/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/detail.md`](../../../../prd/kube-frontend/storage/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在存储详情上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 由夹具创建一个 tc-e2e- 前缀的存储卷，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 从列表点击名称进入详情
2. 读取属性名序列
3. 核对集群与项目两行的值

## 期望结果

- 属性名依次为 集群、项目、存储类型、容量、访问模式、持久卷、创建时间、创建者
- 集群为 host，项目为 default

## 失败排查

- 属性缺失时看 StorageDetailPage 的 Row 列表

## 产品改版后如何更新自动化

- 属性变化时同步改 prd 与 design 的字段表
