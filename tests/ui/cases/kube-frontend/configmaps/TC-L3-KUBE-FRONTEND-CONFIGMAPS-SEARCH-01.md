# TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01 配置字典 · 按名称搜索

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `search`
- **入口**: `{BASE_URL}/c/host/p/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/search.md`

## 产品功能

输入关键字后经服务端过滤，并把页码重置为 1。

### 关联需求

- `prd/kube-frontend/configmaps/search.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/search.md`](../../../../prd/kube-frontend/configmaps/search.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01** — Given 列表已加载，When 在搜索框输入 `nginx`，Then 250ms 后以 `keyword=nginx` 重新请求，列表只显示匹配项，页码重置为 1。

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
- 该空间下对象名包含 nginx

## 测试步骤

1. 打开 {BASE_URL}/c/host/p/default/configmaps
2. 在搜索框输入 nginx
3. 等待 250ms

## 期望结果

- 请求携带 keyword=nginx
- 列表只显示名称包含 nginx 的对象
- 页码回到 1

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
