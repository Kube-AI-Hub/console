# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02 概览 · 可读性

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `overview`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/overview`
- **需求**: `prd/cluster-storage/shared-storage/overview.md`

## 产品功能

概览在深色主题下的文字对比度达标，且不出现未翻译 key。

### 关联需求

- `prd/cluster-storage/shared-storage/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/overview.md`](../../../../prd/cluster-storage/shared-storage/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02** — Given 概览已渲染，When 测量卡片标题、卡片数值、卷目录与已用文字的对比度，Then 正文对比度 ≥ 4.5:1，次要文字 ≥ 3:1，且页面文本里没有未翻译 key。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-03** — Given 某个卷的 statfs 容量与 PV 配额不一致，When 打开概览，Then 出现「待刷新」提示并说明以配额列为准；没有这种情况时不出现该提示。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/overview.md`](../../../../design/cluster-storage/shared-storage/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/overview.md`](../../../../prd/cluster-storage/shared-storage/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为集群运维，在深色主题下看清卡片与使用率条上的每一个数字


**Independent Test**：在同一页面用浏览器取卡片标题、卡片数值、卷目录名、已用/配额文字的 `color` 与最近的背景色，按 WCAG 计算对比度，正文 ≥ 4.5:1；页面上不出现 `_PL`、`_DESC` 这类未翻译 key。

## 前置与配置

- 已登录，且在 default 集群

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/overview
2. 对卡片区与使用率区做对比度审计（阈值 4.5:1，次要文字 3:1）
3. 检查页面文本里是否有 _PL / _DESC 这类 key

## 期望结果

- 对比度审计返回空列表
- 页面文本里没有未翻译 key

## 失败排查

- 对比度不达标时确认页面 SCSS 是否用了 scss/variables 的 token

## 产品改版后如何更新自动化

- 阈值调整时改 helpers/contrast.py 的常量
