# TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02 配置字典 · 搜索无结果

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `search`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/search.md`

## 产品功能

无匹配时呈现空态，而不是空表。

### 关联需求

- `prd/kube-frontend/configmaps/search.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/search.md`](../../../../prd/kube-frontend/configmaps/search.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02** — Given 已输入关键字且无匹配，When 请求完成，Then 页面进入 `empty` 态并显示「暂无配置字典」，而不是空表头。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/search.md`](../../../../design/kube-frontend/configmaps/search.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/search.md`](../../../../prd/kube-frontend/configmaps/search.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，在几十条配置里快速找到目标


**Independent Test**：在搜索框输入 `nginx`，列表在 1 秒内只剩名称包含 `nginx` 的条目，且页码回到第 1 页。

### US2 - 作为项目成员，清空搜索恢复完整列表


**Independent Test**：清空搜索框，列表恢复为未过滤状态，已选项为空。

## 前置与配置

- 已登录

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps
2. 输入一个不存在的名称
3. 等待请求完成

## 期望结果

- 区域 data-ai-state 为 empty
- 显示「暂无配置字典」与引导文案
- 不渲染表头

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
