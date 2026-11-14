# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02 节点列表 · CPU 与内存使用率

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

节点列表显示 CPU 与内存使用率百分比，取值来自节点监控比率。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02** — 已知集群可访问节点监控接口，当打开节点列表，则显示「CPU 使用率」与「内存使用率」，取监控比率乘 100 并四舍五入；指标不可用时显示 `-`，真实零值显示 0%。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认节点是否就绪、还剩多少资源 (Priority: P1)

作为 **集群管理员**，我希望 **一眼看到每个节点的就绪状态与可分配资源**，以便 **判断能否继续调度**。

**Independent Test**：打开节点页，核对状态徽章与 `kubectl get nodes` 的 STATUS 列一致。

## 前置与配置

- 已登录，且有集群权限
- 集群可访问 monitoring.kubesphere.io（不可用时降级为 -）

## 测试步骤

1. 打开节点列表并捕获本次节点监控响应
2. 读取 CPU 使用率与内存使用率单元格

## 期望结果

- 表头含「CPU 使用率」「内存使用率」
- 每格为 0–100 的整数百分比，或为 -（指标不可用）
- 百分比与 API 数值相符（允许四舍五入差 1）

## 失败排查

- 全部为 - 时检查节点监控 API 和采样
- 百分比与原始比率相差百倍时检查乘 100 的换算

## 产品改版后如何更新自动化

- 列变化时改 pages/cluster_management.py
