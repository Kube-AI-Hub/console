# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-08 节点列表 · 搜索筛选和共享分页

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

服务端组合过滤与分页可清除和恢复。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-08** — 名称/IP 搜索、状态、角色、厂商多选 OR、型号包含筛选由服务端执行。条件变化回第一页，可单独清除和清除全部；工作节点包括无 worker 标签节点。复用 ai-kit ResourceList 与 Pagination，每页 10/20/50/100、翻页和跳页对齐其他列表。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 查找节点并比较设备负载 (Priority: P1)

作为 **集群管理员**，我希望 **按状态、角色、厂商及型号查找节点并比较 GPU 与容器组负载**，以便 **在集群总览不变的情况下选择目标节点**。

**Independent Test**：搜索无匹配名称，统计仍与全局接口一致；组合筛选、分页与列显隐可恢复，指标与同次采样一致。

## 前置与配置

- B200 包含 NVIDIA B200 节点及控制面节点

## 测试步骤

1. 按控制面、厂商及型号组合筛选，核对请求条件
2. 清除条件，拦截返回 105 个模拟节点，不创建真实 Node
3. 翻页、改变每页条数、搜索末页节点再清除

## 期望结果

- 组合条件传给服务端，改变条件回第一页
- 分页和条数通过共享组件执行，清除条件恢复完整列表

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
