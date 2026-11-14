# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01 项目概览 · 资源用量卡（有数据/无采样/不可用）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `overview-usage`
- **入口**: `{BASE_URL}/kube-frontend/public/clusters/host/projects/default/overview`
- **需求**: `prd/kube-frontend/project-settings/overview-usage.md`

## 产品功能

项目概览的资源用量卡：CPU/内存/存储/容器组已用与配额上限；监控不可用或无采样时给出对应说明而不是 0。

### 关联需求

- `prd/kube-frontend/project-settings/overview-usage.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/overview-usage.md`](../../../../prd/kube-frontend/project-settings/overview-usage.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01** — 已知项目 `<ns>` 的监控接口有/无用量采样、项目有/无 ResourceQuota，当打开项目概览，则始终出现「资源用量」卡：监控可用且有采样时显示 CPU/内存/容器组（以及监控提供的存储）用量，有配额时同时显示上限；监控返回成功但没有任何采样时显示 `:empty` 说明；监控请求失败时显示 `:unavailable` 说明与重试按钮；任何情况下缺失的数值显示 `-`，不显示假 0。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/overview-usage.md`](../../../../design/kube-frontend/project-settings/overview-usage.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/overview-usage.md`](../../../../prd/kube-frontend/project-settings/overview-usage.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 项目管理员看用量是否接近配额 (Priority: P1)

作为 **项目管理员**，我希望 **在概览页直接看到本项目的 CPU/内存/存储/容器组用量与配额上限**，以便 **判断是否需要调整配额或清理资源**。

**Independent Test**：打开项目概览，核对 CPU/内存/容器组数字与监控接口最新采样一致；监控不可用时看到可重试的说明，而不是 0。

## 前置与配置

- 已登录，且能看到 default 项目
- 监控接口可探测（可能不可用或没有采样）

## 测试步骤

1. 用 API 读项目配额（/api/v1/namespaces/default/resourcequotas）得到上限键
2. 用 API 读项目命名空间监控（/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/default?...）判断分支
3. 打开 default 项目概览，等待 surface 离开 loading
4. 核对资源用量卡存在
5. 按监控结果断言：有采样时四项数值（缺失项为 -），无采样时 :empty，监控失败时 :unavailable

## 期望结果

- project-overview:usage 卡片始终存在
- 有采样：project-overview:usage:cpu/memory/pods 显示数字（允许真实 0），缺失指标显示 -
- 监控 200 且无序列：project-overview:usage:empty 可见
- 监控非 200：project-overview:usage:unavailable 与 :retry 可见，且不出现 usage:cpu 的假 0
- 配额卡不受用量卡状态影响

## 失败排查

- 卡片不出现：用量查询在渲染前抛错，检查路径单复数（应为 namespaces/<ns>）
- 显示 0 但监控无数据：缺失值被按 0 渲染，违反「不显示假 0」
- 一直 loading：窗口时间放在 query key 里导致无限重取

## 产品改版后如何更新自动化

- 选择器：project-overview:usage / :usage:cpu|memory|storage|pods / :usage:empty / :usage:unavailable / :usage:retry
