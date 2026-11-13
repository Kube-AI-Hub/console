# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01 集群配置字典 · 按名称搜索

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `search`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/search.md`

## 产品功能

搜索跨项目按名称过滤，清空后恢复完整列表。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/search.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/search.md`](../../../../prd/kube-frontend/cluster-configmaps/search.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/search.md`](../../../../design/kube-frontend/cluster-configmaps/search.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/search.md`](../../../../prd/kube-frontend/cluster-configmaps/search.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在按名称搜索上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 已登录，且为集群管理员
- 集群内已知某个 ConfigMap 的名称片段

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 在搜索框输入该名称片段
3. 清空搜索框

## 期望结果

- 结果回到第 1 页且只显示名称匹配的对象
- 结果可来自任意项目
- 清空后恢复完整列表

## 失败排查

- 结果未变化时确认防抖 250ms 已过

## 产品改版后如何更新自动化

- 搜索参数名变化时同步本文件
