# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-02 项目列表 · CPU/内存用量与容器组数

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `projects`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/namespaces`
- **需求**: `prd/kube-frontend/cluster-management/projects.md`

## 产品功能

项目列表显示按项目聚合的 CPU、内存用量与容器组数，数值来自 metrics.k8s.io/pods 的容器用量之和。

### 关联需求

- `prd/kube-frontend/cluster-management/projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/projects.md`](../../../../prd/kube-frontend/cluster-management/projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-02** — 已知集群可访问 metrics.k8s.io，当打开项目列表，则显示「CPU 使用率」「内存使用率」「容器组数」三列，其中容器组数与该项目的 Pod 数一致，用量为该项目所有 Pod 容器用量之和（非全 0）。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/projects.md`](../../../../design/kube-frontend/cluster-management/projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/projects.md`](../../../../prd/kube-frontend/cluster-management/projects.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看到集群里有哪些项目 (Priority: P1)

作为 **集群管理员**，我希望 **一次看到所有项目及其所属企业空间**，以便 **确认归属关系**。

**Independent Test**：打开项目页，核对名称集合与 `kubectl get ns` 一致。

## 前置与配置

- 已登录，且有集群权限
- 集群可访问 metrics.k8s.io（不可用时降级为 0）

## 测试步骤

1. 用 API 读取全部 Pod 指标，按命名空间汇总
2. 打开项目列表
3. 对比有 Pod 的项目行的容器组数

## 期望结果

- 表头含 CPU 使用率、内存使用率、容器组数
- 有 Pod 的项目，其容器组数与 API 统计一致
- 用量非零（容器用量之和），不是全 0

## 失败排查

- 容器组数对但用量为 0：pod 的 usage 在 containers[] 里，不在顶层
- 全为 0：metrics.k8s.io 不可用

## 产品改版后如何更新自动化

- 列变化时改 pages/cluster_management.py
