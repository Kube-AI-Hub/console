# TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02 配置字典 · 删除并刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `delete`
- **入口**: `{BASE_URL}/c/host/p/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/delete.md`

## 产品功能

确认后删除成功，列表重新拉取。

### 关联需求

- `prd/kube-frontend/configmaps/delete.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/delete.md`](../../../../prd/kube-frontend/configmaps/delete.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02** — Given 已选中若干行，When 确认删除且上游成功，Then 列表重新拉取，已选项清空；When 上游失败，Then 页面显示可读错误且不静默吞掉。

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
- 存在一条测试专用的 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/c/host/p/default/configmaps
2. 点击该行「删除」
3. 在确认框点确定

## 期望结果

- 确认框出现
- 删除请求返回 204
- 列表重新拉取且该行消失
- 已选项清空

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
