# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01 GPU 资源监控 · 窗口切换与趋势/空态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gpu-resource`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gpu-resource`
- **需求**: `prd/kube-frontend/cluster-management/gpu-resource.md`

## 产品功能

集群 GPU 资源监控：1h/6h/24h 三档窗口下 GPU 利用率与显存利用率的趋势（内联 SVG 柱图），有数据时柱数 > 0，无数据时明确空态；切换窗口时区间与采样步长同步变化。

### 关联需求

- `prd/kube-frontend/cluster-management/gpu-resource.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gpu-resource.md`](../../../../prd/kube-frontend/cluster-management/gpu-resource.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01** — 已知集群接入了监控后端与 GPU 指标，当打开 GPU 资源监控页，则默认 1 小时窗口展示 GPU 利用率与显存利用率两条趋势（有数据时每张图柱数 > 0、数值为百分比），可切换到 6 小时 / 24 小时且当前窗口标记与请求区间、采样步长同步变化；当所选窗口没有任何 GPU 指标数据时，显示明确的空态说明，而不是空白图表或错误页。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gpu-resource.md`](../../../../design/kube-frontend/cluster-management/gpu-resource.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gpu-resource.md`](../../../../prd/kube-frontend/cluster-management/gpu-resource.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群运维看 GPU 利用率与显存随时间的走势

作为 **集群运维**，我希望 **在集群 GPU 资源页选择时间窗口看利用率与显存趋势**，以便 **判断算力是否吃满、显存是否接近上限，以及最近一次变更后是否变差**。

**Independent Test**：打开 `/clusters/host/gpu-resource`，三档窗口可切换；窗口内有数据时图表出现且柱数 > 0，无数据时显示空态说明。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群启用监控后端；GPU 指标由 gpu-agent 的 recording rules 提供（没有数据时用例按空态断言）

## 测试步骤

1. 用 API 读监控区间接口，记下 1h 窗口两个 GPU 指标的采样点数
2. 打开 /kube-frontend/clusters/<cluster>/gpu-resource，等页面 ready
3. 核对三档窗口按钮存在且默认 1 小时为按下态
4. 有采样点时核对图表出现、柱数 > 0、data-ai-window 为 1h；无采样点时核对空态可见
5. 依次点 6 小时 / 24 小时，核对按下态转移，且图表 data-ai-window 跟随（有数据时）
6. 切回 1 小时并截图

## 期望结果

- 页面可打开且 ready；三档窗口可切换，当前窗口标记随之变化
- 有数据时每张趋势图柱数 > 0，且 data-ai-points > 0
- 无数据时出现「该时间范围内没有 GPU 监控数据」空态，而不是空白图表或错误页

## 失败排查

- 一直是空态：集群没有 gpu-agent / 监控 recording rule（看 design 已知坑），不是页面缺陷
- 图表出现但值为 0.53%：比例没有 ×100（接口是 0..1）
- 窗口切换后图表没变：data-ai-window 没跟 windowKey 走，或 query key 漏了 windowKey
- 一直 loading：监控区间接口慢/不可用（用例已先探接口，探不到会 skip）

## 产品改版后如何更新自动化

- 选择器见 GpuResourcePage.tsx：cluster-gpu-resource:surface / :range / :range:<1h|6h|24h> / :chart（data-ai-window、data-ai-points）/ :empty / [data-ai-bar]
