# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01 集群配置字典 · 详情按项目定位

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/detail.md`

## 产品功能

同名对象分属两个项目时，详情页各自打开对应项目的对象。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/detail.md`](../../../../prd/kube-frontend/cluster-configmaps/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01** — Given 已登录，When 执行主操作，Then 结果符合预期。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/detail.md`](../../../../design/kube-frontend/cluster-configmaps/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/detail.md`](../../../../prd/kube-frontend/cluster-configmaps/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为运维，在集群配置字典详情上完成一次真实操作并看到结果


**Independent Test**：打开 `{entry_url}`，执行该功能点的主操作，核对可观察结果。

## 前置与配置

- 已登录，且为集群管理员
- 两个项目中存在同名 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 分别点击两条同名对象的名称进入详情
3. 核对属性区的「项目」
4. 核对 URL 的 namespace 参数

## 期望结果

- 两次详情分别显示对应项目的对象
- URL 分别带各自的 ?namespace=

## 失败排查

- 详情显示「未找到」时检查 URL 是否缺 namespace

## 产品改版后如何更新自动化

- 详情路由变化时同步本文件
