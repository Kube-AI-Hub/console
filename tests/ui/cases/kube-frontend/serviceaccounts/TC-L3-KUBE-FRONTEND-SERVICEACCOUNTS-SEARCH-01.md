# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01 服务账户 · 按名称搜索

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `search`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/search.md`

## 产品功能

搜索交给上游并重置页码与选择。

### 关联需求

- `prd/kube-frontend/serviceaccounts/search.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/search.md`](../../../../prd/kube-frontend/serviceaccounts/search.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01** — Given 列表已加载，When 在搜索框输入关键字，Then 请求带 `name=<关键字>` 且 `page=1`，列表与总数只包含匹配项，已选项被清空。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/search.md`](../../../../design/kube-frontend/serviceaccounts/search.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/search.md`](../../../../prd/kube-frontend/serviceaccounts/search.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，在长列表里定位某个服务账户


**Independent Test**：输入名称片段，列表只剩名称包含该片段的条目，总数随之变化；清空输入后恢复全量。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 在搜索框输入 tc-e2e-
2. 清空搜索框

## 期望结果

- 列表只剩名称包含该片段的条目
- 每行都包含关键字
- 清空后恢复全量

## 失败排查

- 未生效时检查请求是否带 name 参数

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
