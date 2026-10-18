# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01 概览 · 汇总数字

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `overview`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/overview`
- **需求**: `prd/cluster-storage/shared-storage/overview.md`

## 产品功能

概览四张卡片的数值与各卷使用率条一致，且总配额等于卷页各行配额之和。

### 关联需求

- `prd/cluster-storage/shared-storage/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/overview.md`](../../../../prd/cluster-storage/shared-storage/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01** — Given 集群有两个共享卷，When 打开概览，Then 四张卡片分别显示共享卷数 2、总配额为两卷容量之和、总已用为两卷用量之和、最高使用率等于最满卷的 used/capacity。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/overview.md`](../../../../design/cluster-storage/shared-storage/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/overview.md`](../../../../prd/cluster-storage/shared-storage/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，打开概览，一眼看出总容量与最满的卷


**Independent Test**：打开 `/clusters/default/juicefs-storage/overview`，核对四张卡片的数值与 `kubectl get pv` 的容量之和一致；各卷使用率条按从高到低排列，条上百分比与卡片「最高使用率」相同。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有两个共享卷

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/overview
2. 读取四张卡片的标题与数值
3. 读取各卷使用率条上的目录、已用/配额与百分比
4. 打开 /clusters/default/juicefs-storage/volumes，把各行配额相加

## 期望结果

- 卡片标题依次为共享卷 / 总配额 / 总已用 / 最高使用率
- 共享卷数等于卷页表格行数
- 总配额等于卷页各行配额之和（按显示精度允许 0.1 的误差）
- 最高使用率等于使用率条里的最大值

## 失败排查

- 数字对不上时先确认 /summary 与 /volumes 是否同一时刻返回

## 产品改版后如何更新自动化

- 卡片顺序变化时改 pages/juicefs_storage.py 的 card 选择器
