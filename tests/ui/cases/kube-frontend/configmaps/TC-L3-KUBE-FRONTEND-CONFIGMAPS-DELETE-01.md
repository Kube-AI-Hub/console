# TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01 配置字典 · 批量删除按钮可用性

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `delete`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/delete.md`

## 产品功能

未选中时禁用并暴露前置依赖。

### 关联需求

- `prd/kube-frontend/configmaps/delete.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/delete.md`](../../../../prd/kube-frontend/configmaps/delete.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01** — Given 列表已加载，When 未选中任何行，「批量删除」保持禁用且带 `data-ai-needs="configmaps:row-select"`；勾选一行后变为可用并显示 `(1)`。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/delete.md`](../../../../design/kube-frontend/configmaps/delete.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/delete.md`](../../../../prd/kube-frontend/configmaps/delete.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，删除一条不再使用的配置


**Independent Test**：点击某行的「删除」，确认后该行消失；`kubectl get configmap <name>` 返回 NotFound。

### US2 - 作为项目成员，一次清理多条配置


**Independent Test**：勾选两行，「批量删除」由禁用变为可用并显示数量，确认后两行都消失。

## 前置与配置

- 已登录
- 列表已加载

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps
2. 观察「批量删除」
3. 勾选一行

## 期望结果

- 未选中时按钮 disabled
- 按钮带 data-ai-needs="configmaps:row-select"
- 勾选后按钮可用且显示 (1)

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
