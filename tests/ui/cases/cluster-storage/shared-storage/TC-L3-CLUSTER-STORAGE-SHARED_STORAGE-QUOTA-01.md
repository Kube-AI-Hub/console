# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01 卷与配额 · 表格与可读性

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `quota`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/volumes`
- **需求**: `prd/cluster-storage/shared-storage/quota.md`

## 产品功能

卷页八列表格齐全、每行有配额与操作按钮，且表格文字在深色主题下可读。

### 关联需求

- `prd/cluster-storage/shared-storage/quota.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/quota.md`](../../../../prd/cluster-storage/shared-storage/quota.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01** — Given 集群有两个共享卷，When 打开卷页，Then 表格出现两行，八列表头齐全，每行的配额、已用、使用率、inodes、挂载节点都有值，行尾有「调整配额」按钮。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-03** — Given 卷页已渲染，When 测量表头与表格正文的对比度，Then 正文 ≥ 4.5:1，次要文字 ≥ 3:1，且没有未翻译 key。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/quota.md`](../../../../design/cluster-storage/shared-storage/quota.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/quota.md`](../../../../prd/cluster-storage/shared-storage/quota.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，在表格里核对每个共享卷的配额与用量


**Independent Test**：打开 `/clusters/default/juicefs-storage/volumes`，核对表头为卷 / 目录 / 配额 / 已用 / 使用率 / inodes / 挂载节点 / 操作八列；每行的配额与 `kubectl get pv <name> -o jsonpath='{.spec.capacity.storage}'` 一致；目录为嵌套卷时显示「位于 model-cache 内」。

### US3 - 作为集群运维，在深色主题下看清表格里的每一个字段


**Independent Test**：在同一页面测量表头、卷名、目录、配额、已用、百分比文字的对比度，正文 ≥ 4.5:1；页面不出现未翻译 key。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有一个共享卷

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/volumes
2. 读取表头
3. 读取每一行的卷名、目录、配额、已用、使用率、inodes、挂载节点与操作列
4. 对表格区做对比度审计（阈值 4.5:1）

## 期望结果

- 表头为卷 / 目录 / 配额 / 已用 / 使用率 / inodes / 挂载节点 / 空
- 每行配额显示为 TiB/GiB 而非原始字节数
- 嵌套卷的目录下有「位于 model-cache 内」
- 每行操作列有「调整配额」
- 对比度审计返回空列表

## 失败排查

- 配额显示成字节数说明 Table 用了 renderCell 而不是 column.render
- 文字看不清时确认 SCSS 用了 token

## 产品改版后如何更新自动化

- 列顺序变化时改 pages/juicefs_storage.py
