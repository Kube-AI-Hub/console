# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01 集群日志收集 · 收集器、输入与输出

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `log-collections`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/log-collections`
- **需求**: `prd/kube-frontend/cluster-management/log-collections.md`

## 产品功能

集群日志收集只读页：收集器（含就绪 Pod 数）、输入清单、输出清单。

### 关联需求

- `prd/kube-frontend/cluster-management/log-collections.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/log-collections.md`](../../../../prd/kube-frontend/cluster-management/log-collections.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01** — 已知集群部署了日志收集，当打开集群日志收集页，则收集器显示名称、命名空间、配置、镜像与「就绪 Pod x/y」；输入区逐条列出名称与插件/标签；输出区逐条列出名称、插件、目标地址与 match；三区条数分别等于 fluentbits / inputs / outputs 的 CR 条数；未部署时显示空态。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/log-collections.md`](../../../../design/kube-frontend/cluster-management/log-collections.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/log-collections.md`](../../../../prd/kube-frontend/cluster-management/log-collections.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认日志真的在收集 (Priority: P1)

作为 **集群管理员**，我希望 **看到收集器是否在运行、有哪些输入与输出**，以便 **排查「日志查不到」是采集没起来还是输出没配上**。

**Independent Test**：打开日志收集页，核对就绪 Pod 数等于 `app.kubernetes.io/name=fluent-bit` 的 Pod 中 Running 数；输入/输出条数等于 CR 条数。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群部署了日志收集（logging.kubesphere.io CR 存在）

## 测试步骤

1. 用 API 读取 fluentbits / inputs / outputs 与收集器 Pod
2. 打开集群日志收集页
3. 核对三区条数
4. 核对收集器徽标显示就绪 Pod 数

## 期望结果

- 页可达且 ready
- 收集器、输入、输出条数分别等于 CR 条数
- 就绪 Pod 数等于 Running 的收集器 Pod 数

## 失败排查

- 整页 404 或空：读了 kapis（404），应读 /apis/logging.kubesphere.io
- 徽标恒为「未知」：依赖了 CR status（本集群为空）
- 输入插件列为空：spec 插件键取错（第一个键就是插件）

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterLogCollectionsPage.tsx
