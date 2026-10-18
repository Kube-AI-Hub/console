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

## 验收场景
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01** — Given 集群有两个共享卷，When 打开概览，Then 四张卡片分别显示共享卷数 2、总配额为两卷容量之和、总已用为两卷用量之和、最高使用率等于最满卷的 used/capacity。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02** — Given 概览已渲染，When 测量卡片标题、卡片数值、卷目录与已用文字的对比度，Then 正文对比度 ≥ 4.5:1，次要文字 ≥ 3:1，且页面文本里没有未翻译 key。
- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-03** — Given 某个卷的 statfs 容量与 PV 配额不一致，When 打开概览，Then 出现「待刷新」提示并说明以配额列为准；没有这种情况时不出现该提示。
## 设计目标
- 卡片数字必须是**可加总的事实**：总配额 = 各卷 PV 容量之和，总已用 = 各卷 kubelet 统计之和，最高使用率 = 各卷 used/capacity 的最大值。
- 颜色只取主题 token：深色主题下 `#242e42` 在卡片底上只有 2.12:1，必须用 `$dark`（5.29:1）。
- 提示条只在确有情况时出现，不堆砌。
## 约束与边界
- 只读页面，没有写操作。
- 数字来自卷列表接口一次返回的汇总；不在前端重新聚合出第二套口径。
- 使用率条的分级（safe/warning/error）与卷页共用同一套阈值。
## UI 交互设计
- 四张卡片等宽一行；窄屏（<1280）自动折行。
- 使用率条：名称（目录 + claim）在左，条在中间，`已用 / 配额 + 百分比` 在右。
- 提示条为浅底深字，左侧 3px 色条区分 info / warning。
## 文案与校验
| key | 中文 | 用途 |
| --- | --- | --- |
| `SHARED_STORAGE_VOLUME_COUNT` | 共享卷 | 卡片标题 |
| `SHARED_STORAGE_TOTAL_CAPACITY` | 总配额 | 卡片标题 |
| `SHARED_STORAGE_TOTAL_USED` | 总已用 | 卡片标题 |
| `SHARED_STORAGE_FULLEST_VOLUME` | 最高使用率 | 卡片标题 |
| `SHARED_STORAGE_QUOTA_DRIFT_HINT` | 卷 {volumes} 的 statfs 容量与 PV 配额暂时不一致… | 提示 |
| `SHARED_STORAGE_NESTED_HINT` | 公共模型库是模型缓存的子目录… | 提示 |
| `SHARED_STORAGE_METRICS_OFF_HINT` | JuiceFS 客户端指标未开启… | 提示 |
## 边界情况
- 没有任何共享卷：卡片显示 0，使用率区显示空态，不显示提示条。
- 卷的 `usedBytes` 为 0（未挂载）：使用率条按 0% 渲染，仍显示该行。
- 汇总接口失败：卡片显示占位，页面不白屏。
## 功能需求
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01** — 系统 MUST 在概览展示共享卷数、总配额、总已用、最高使用率四项汇总。
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02** — 系统 MUST 使用主题 token 渲染文字，正文对比度 ≥ 4.5:1。
- **FR-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-03** — 系统 MUST 在配额与 statfs 不一致时给出「待刷新」提示。
## 成功标准
- **SC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01** — 概览首屏 3 秒内出现四张卡片。
- **SC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02** — 对比度审计零违规。
## 明确不做
- 不做按时间的历史趋势（那是性能页）。
- 不做告警配置入口。
## 假设
- 汇总接口 `GET /kapis/juicefs.kubesphere.io/v1alpha1/summary` 可用。
## 验收用例
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02`

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
