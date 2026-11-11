# TC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01 保密字典 · 按名称搜索

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `search`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/search.md`

## 产品功能

搜索交给上游，并重置页码与选择。

### 关联需求

- `prd/kube-frontend/secrets/search.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/search.md`](../../../../prd/kube-frontend/secrets/search.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01** — Given 列表已加载，When 在搜索框输入关键字，Then 请求带上 `name=<关键字>`，列表与总数只包含名称匹配的条目，页码回到第 1 页，已选项清空。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/search.md`](../../../../design/kube-frontend/secrets/search.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/search.md`](../../../../prd/kube-frontend/secrets/search.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，在几十条 Secret 里找到某一条


**Independent Test**：在搜索框输入某个 Secret 名称中的一段，列表只剩名称包含该片段的条目，总数显示为匹配数；清空后恢复全量。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 存在名称以 tc-e2e- 开头的一条对象

## 测试步骤

1. 在搜索框输入 tc-e2e-
2. 清空搜索框

## 期望结果

- 列表只剩名称包含该片段的条目
- 每一行都包含该关键字
- 清空后恢复全量，总数回到全量

## 失败排查

- 关键字未生效时先看请求是否带 name 参数

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
