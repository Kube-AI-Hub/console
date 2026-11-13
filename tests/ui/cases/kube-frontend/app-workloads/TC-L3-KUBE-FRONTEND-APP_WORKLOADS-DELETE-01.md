# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01 删除负载 · 行操作删除并确认

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `delete`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/delete.md`

## 产品功能

行操作「删除」在输入名称后确认，行消失且对象从 API 返回 404。

### 关联需求

- `prd/kube-frontend/app-workloads/delete.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/delete.md`](../../../../prd/kube-frontend/app-workloads/delete.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01** — 已知列表有一行，当删除并确认，则对话框关闭且该行消失。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/delete.md`](../../../../design/kube-frontend/app-workloads/delete.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/delete.md`](../../../../prd/kube-frontend/app-workloads/delete.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 删掉不再需要的负载 (Priority: P2)

作为 **项目运维**，我希望 **确认后删除，并可一次删多个**，以便 **清理项目**。

**Independent Test**：创建一个一次性部署并删除，核对列表不再出现。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的部署，用例结束后无条件删除（已删除时容忍 404）
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署列表
2. 打开目标行的更多操作并选择「删除」
3. 在确认框输入对象名并提交

## 期望结果

- 确认按钮只有在名称完全一致时才可用
- 提交后对话框关闭，目标行从列表消失
- 用 API 读取该部署返回 404

## 失败排查

- 行不消失时看删除后是否 invalidateQueries 重新拉取
- 删除 404 但行仍在时看列表是否命中旧缓存

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 确认框结构变化时改 pages/app_workloads.py
