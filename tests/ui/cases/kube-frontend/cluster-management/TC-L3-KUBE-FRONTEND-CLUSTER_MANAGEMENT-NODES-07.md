# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-07 节点列表 · 集群总览

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

列表条件不改变顶部集群统计。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-07** — 顶部显示非 edge 节点总数、控制面数量、健康率及厂商数量，统计始终为整个集群，不随列表条件变化；健康口径取 stats.healthy，不冒充 Ready 数量。失败有重试，未知不显示零。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 查找节点并比较设备负载 (Priority: P1)

作为 **集群管理员**，我希望 **按状态、角色、厂商及型号查找节点并比较 GPU 与容器组负载**，以便 **在集群总览不变的情况下选择目标节点**。

**Independent Test**：搜索无匹配名称，统计仍与全局接口一致；组合筛选、分页与列显隐可恢复，指标与同次采样一致。

## 前置与配置

- B200 host 集群至少有一个节点

## 测试步骤

1. 读取全局 stats 和控制面 totalItems，与页面逐项对账
2. 搜索无匹配名称，再清除搜索

## 期望结果

- 总数、控制面、健康率和厂商数量与接口一致
- 无匹配时列表为空但总览不变，清除后恢复

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
