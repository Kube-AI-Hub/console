# TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01 配置字典 · 状态可读

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `ai-surface`
- **入口**: `{BASE_URL}/c/host/p/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/ai-surface.md`

## 产品功能

区域根元素发布四态之一，加载中标记 aria-busy。

### 关联需求

- `prd/kube-frontend/configmaps/ai-surface.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/ai-surface.md`](../../../../prd/kube-frontend/configmaps/ai-surface.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01** — Given 页面正在加载，When 读取区域根元素的 `data-ai-state`，Then 为 `loading` 且 `aria-busy="true"`；加载完成后同一元素为 `ready` / `empty` / `error` 之一。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/ai-surface.md`](../../../../design/kube-frontend/configmaps/ai-surface.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/ai-surface.md`](../../../../prd/kube-frontend/configmaps/ai-surface.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为智能体，判断页面是否可用再行动


**Independent Test**：轮询 `data-ai-state`，在 `loading` 时不点击任何操作；在 `ready` 后枚举 `data-ai-id` 并完成一次搜索。

### US2 - 作为智能体，知道某个动作为什么不可用


**Independent Test**：读取「批量删除」按钮的 `data-ai-needs`，据此先执行选择动作，再点击删除。

## 前置与配置

- 已登录

## 测试步骤

1. 打开 {BASE_URL}/c/host/p/default/configmaps
2. 加载过程中读取 data-ai-state
3. 加载完成后再次读取

## 期望结果

- 加载中为 loading 且 aria-busy=true
- 完成后为 ready 或 empty
- 请求失败时为 error

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
