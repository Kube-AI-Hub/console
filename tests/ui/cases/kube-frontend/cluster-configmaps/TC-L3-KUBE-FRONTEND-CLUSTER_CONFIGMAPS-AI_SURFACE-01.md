# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01 集群配置字典 · 智能体句柄

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `ai-surface`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/ai-surface.md`

## 产品功能

页面暴露稳定的 cluster-configmaps: 前缀句柄，行句柄包含项目。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/ai-surface.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/ai-surface.md`](../../../../prd/kube-frontend/cluster-configmaps/ai-surface.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/ai-surface.md`](../../../../design/kube-frontend/cluster-configmaps/ai-surface.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/ai-surface.md`](../../../../prd/kube-frontend/cluster-configmaps/ai-surface.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在智能体可操作性上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 已登录，且为集群管理员

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 检查 data-ai-id 与 data-ai-row
3. 通过句柄执行一次搜索

## 期望结果

- 存在 cluster-configmaps:surface / :search / :create / :select:<ns>/<name> / :bulk-delete
- 行句柄形如 <ns>/<name>，页内唯一
- 搜索后 data-ai-state 仍可读

## 失败排查

- 句柄缺失时先看组件是否走了 AiButton 或 actionProps

## 产品改版后如何更新自动化

- 句柄改名时同步 design 与页面清单
