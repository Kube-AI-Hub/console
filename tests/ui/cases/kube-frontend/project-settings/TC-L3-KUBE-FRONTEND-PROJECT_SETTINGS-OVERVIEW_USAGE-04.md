# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-04 项目概览 · 资源用量趋势（1h/6h/24h）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `overview-usage`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/overview`
- **需求**: `prd/kube-frontend/project-settings/overview-usage.md`

## 产品功能

项目概览提供「资源用量趋势」：CPU 与内存两张独立曲线，可切换最近 1/6/24 小时；切换后按新窗口重新取数，无采样显示空态、失败可重试。

### 关联需求

- `prd/kube-frontend/project-settings/overview-usage.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/overview-usage.md`](../../../../prd/kube-frontend/project-settings/overview-usage.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-04** — 已知项目 `<ns>` 的监控在所选时间窗内有采样，当打开项目概览，则「资源用量趋势」区块按 CPU 与内存两张独立曲线呈现（核与字节不共用纵轴），并可在「最近 1 小时 / 6 小时 / 24 小时」之间切换；切换后重新按新窗口取数（`step` 在 6 小时以上放大到 300s）；窗口内无采样时显示空态说明，请求失败时显示可重试的说明；缺失的采样点在曲线上表现为断点而不是 0。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/overview-usage.md`](../../../../design/kube-frontend/project-settings/overview-usage.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/overview-usage.md`](../../../../prd/kube-frontend/project-settings/overview-usage.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 项目管理员看用量是否接近配额 (Priority: P1)

作为 **项目管理员**，我希望 **在概览页直接看到本项目的 CPU/内存/存储/容器组用量与配额上限**，以便 **判断是否需要调整配额或清理资源**。

**Independent Test**：打开项目概览，核对 CPU/内存/容器组数字与监控接口最新采样一致；监控不可用时看到可重试的说明，而不是 0。

## 前置与配置

- 已登录；项目 default 的监控有采样

## 测试步骤

1. 打开项目概览，等待趋势区块出现
2. 核对默认窗口为「最近 1 小时」且渲染 CPU 与内存两张曲线
3. 切到「最近 6 小时」，核对发出新的区间请求（start/end 随窗口变化）

## 期望结果

- 区块 project-overview:trend 存在；有数据时 :trend:charts 出现且同时含 :trend:cpu 与 :trend:memory
- 窗口页签句柄 :trend:window:1h / :6h / :24h 存在，默认 1h
- 切换后请求的 start 与 1h 时不同（窗口变化触发重新取数）
- 无采样时显示 :trend:empty，失败时 :trend:error 与 :trend:retry，且都不显示 0 值曲线

## 失败排查

- 曲线贴底成直线：CPU 与内存画在了同一坐标系
- 24h 仍按 60s 取数：窗口没有决定 step

## 产品改版后如何更新自动化

- 句柄：project-overview:trend / :trend:window:{1h,6h,24h} / :trend:charts / :trend:cpu / :trend:memory / :trend:empty / :trend:error / :trend:retry
