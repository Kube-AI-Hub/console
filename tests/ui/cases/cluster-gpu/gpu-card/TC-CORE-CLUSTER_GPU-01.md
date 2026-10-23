# TC-CORE-CLUSTER_GPU-01 集群算力 · 入口与显卡总览

- **用例 ID**: `TC-CORE-CLUSTER_GPU-01`
- **级别**: L1  **套件**: `core`
- **模块**: `cluster-gpu` / `gpu-card` `page`
- **入口**: `{BASE_URL}/clusters/default/gpus`
- **需求**: `prd/cluster-gpu/_index.md`

## 产品功能

集群算力入口可打开，显卡列表与健康比例可见，不出现未翻译 key。

### 关联需求

- `prd/cluster-gpu/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-gpu/_index.md`](../../../../prd/cluster-gpu/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-CORE-CLUSTER_GPU-01** — Given 已登录且对 `nodes` 有 view 权限，When 打开 `/clusters/default/gpus`，Then 页面标题为「显卡」、显卡列表可见、顶部显示健康显卡比例，且不出现任何未翻译的 key。

### 关联设计

- 技术方案 [`design/cluster-gpu/_index.md`](../../../../design/cluster-gpu/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-gpu/_index.md`](../../../../prd/cluster-gpu/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，从集群菜单进入算力，看到显卡总览与健康比例


**Independent Test**：打开 `/clusters/default/gpus`，页面出现显卡总数、健康显卡比例与按厂商-型号分组的计数；健康数与 `kubectl get node -o json` 里各节点 register annotation 中 `health:true` 的条数之和一致。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有一个 GPU 节点

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/gpus
2. 读取页面标题与表格表头
3. 读取健康显卡比例的文本
4. 检查页面是否出现未翻译的 key

## 期望结果

- 页面标题为「显卡」
- 表格含节点 / 序号 / UUID / 状态 / 型号 / NUMA / 厂商 / 模式 / vGPU / 核心 / 显存
- 健康比例显示为百分比
- 不出现形如 XXX_PL / XXX_SCAP 的未翻译 key

## 失败排查

- 表格为空时先确认节点上有 hami.io/node-nvidia-register 注解
- 健康比例恒为 100% 时确认 register 注解里是否有 health:false

## 产品改版后如何更新自动化

- 列顺序变化时改 pages/gpu_cards.py
