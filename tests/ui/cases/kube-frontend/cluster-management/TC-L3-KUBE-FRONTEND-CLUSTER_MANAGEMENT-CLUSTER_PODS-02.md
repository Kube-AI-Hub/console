# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02 集群级容器组 · 保留搜索条件刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-pods`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/pods`
- **需求**: `prd/kube-frontend/cluster-management/cluster-pods.md`

## 产品功能

在集群级容器组列表刷新当前搜索结果，不重置搜索条件。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-pods.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pods.md`](../../../../prd/kube-frontend/cluster-management/cluster-pods.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02** — 在容器组列表或空态点击刷新时，重新读取当前搜索、排序和分页对应的容器组；请求期间显示刷新中，结束后展示最新结果，失败时显示错误与重试入口。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-pods.md`](../../../../design/kube-frontend/cluster-management/cluster-pods.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pods.md`](../../../../prd/kube-frontend/cluster-management/cluster-pods.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群里此刻有哪些容器组 (Priority: P1)

作为 **集群管理员**，我希望 **跨项目查看容器组**，以便 **在不知道属于哪个项目时先找到它**。

**Independent Test**：打开集群级容器组页，核对行数等于接口首页条数，项目列等于对象所在命名空间，名称链接带正确 workspace 段。

## 前置与配置

- 已登录，且对 host 集群有读取权限

## 测试步骤

1. 打开容器组列表并输入一个唯一的不存在的名称
2. 等待列表进入空态
3. 点击刷新并等待容器组请求完成

## 期望结果

- 发出新的容器组列表请求并成功返回
- 搜索条件保持不变，列表仍显示空态

## 失败排查

- 没有请求：检查刷新按钮是否接到当前查询的 refetch
- 搜索条件丢失：检查刷新是否重置了列表状态

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterPodsPage.tsx
