# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-05 切到未就绪集群 · 概览不留上一集群数据

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-switch`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/cluster-switch.md`

## 产品功能

切换到未就绪集群后，各区块按目标集群重读；失败显示原因，不显示上一集群的数值。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-05** — 切换到状态未就绪的集群后，概览各区块不显示上一个集群的数据：资源用量、节点数、Top5 排行、Kubernetes 状态、系统组件、基本信息全部按目标集群重新读取；读取失败时区块显示失败与原因（如「cluster &lt;name&gt; is not ready」），不留旧值、不显示 0 冒充数据。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-switch.md`](../../../../design/kube-frontend/cluster-management/cluster-switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群之间直接切换 (Priority: P1)

作为 **平台管理员**，我希望 **在集群控制台里直接切到另一个集群**，以便 **比较或处理多个集群而不必回到列表重新找**。

**Independent Test**：在 `host` 概览点击侧栏顶部切换器，选择另一个集群；地址变为该集群的概览，切换器显示新集群名；再切回 `host`。

## 前置与配置

- 已登录，且有平台管理权限
- 存在一个未就绪的代理集群（用例自行创建，结束删除）

## 测试步骤

1. 在已就绪集群概览记录资源用量、节点数、排行行、Kubernetes 状态与系统组件
2. 用切换器切到未就绪集群
3. 逐块读取资源用量、节点数、排行、Kubernetes 状态、系统组件与基本信息
4. 对同一集群地址整页刷新后再读一次

## 期望结果

- 资源用量、节点数、Kubernetes 状态显示「监控数据不可用」，不出现上一集群的数字
- 排行与系统组件显示失败与上游原因（cluster <name> is not ready），行数为 0
- 基本信息状态为「未就绪」，节点数为目标集群的值而非上一集群的值
- 整页刷新后结论相同，说明不是仅靠客户端状态复位

## 失败排查

- 出现上一集群节点名：检查排行与节点读取是否把集群放进路径（DEC-06）
- 显示「网络异常」而非原因：5xx 原因被丢弃（DEC-07）

## 产品改版后如何更新自动化

- 页面对象选择器变化时改 pages/cluster_overview.py
