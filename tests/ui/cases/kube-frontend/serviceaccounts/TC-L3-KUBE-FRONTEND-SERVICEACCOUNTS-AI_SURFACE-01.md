# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01 服务账户 · 状态与句柄契约

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `ai-surface`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/ai-surface.md`

## 产品功能

区域四态、行与动作句柄、kubeconfig 句柄。

### 关联需求

- `prd/kube-frontend/serviceaccounts/ai-surface.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/ai-surface.md`](../../../../prd/kube-frontend/serviceaccounts/ai-surface.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01** — Given 打开服务账户列表与详情，Then `serviceaccounts:surface` 与 `serviceaccount-detail:surface` 的 `data-ai-state` 为四态之一；每行带 `data-ai-row`；`serviceaccounts:bulk-delete` 带 `data-ai-needs="serviceaccounts:row-select"`；详情中存在 `serviceaccount-detail:kubeconfig:<secret>` 与 `serviceaccount-detail:toggle:<secret>`，后者 `aria-pressed` 初始为 `false`。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/ai-surface.md`](../../../../design/kube-frontend/serviceaccounts/ai-surface.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/ai-surface.md`](../../../../prd/kube-frontend/serviceaccounts/ai-surface.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为智能体，拿到某个服务账户的 kubeconfig 全文


**Independent Test**：打开详情，读取 `serviceaccount-detail:kubeconfig:<secret>` 元素的文本，即为完整 kubeconfig。

### US2 - 作为智能体，识别列表四态并批量删除


**Independent Test**：读取 `serviceaccounts:surface` 状态；勾选两行后点 `serviceaccounts:bulk-delete`，按提示输入两个名称后确认。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 测试账户挂载一个令牌 Secret

## 测试步骤

1. 打开列表读取状态与句柄
2. 打开详情读取 kubeconfig 与遮挡开关句柄

## 期望结果

- 状态为四态之一
- 每行带 data-ai-row
- bulk-delete 带 data-ai-needs
- 存在 serviceaccount-detail:kubeconfig:<secret> 且文本非空
- 遮挡开关 aria-pressed=false

## 失败排查

- 句柄缺失时对照 pages/serviceaccounts 源码

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
