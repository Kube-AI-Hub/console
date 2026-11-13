# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01 节点 · 列表五列与就绪状态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

['节', '点', '列', '表', '显', '示', '名', '称', '、', '状', '态', '、', '角', '色', '、', 'C', 'P', 'U', '、', '内', '存', '，', '状', '态', '为', None, 'R', 'e', 'a', 'd', 'y', None, '或', None, 'N', 'o', 't', 'R', 'e', 'a', 'd', 'y', '。']

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01** — 已知集群至少有一个节点，当打开节点页，则显示名称、状态、角色、CPU、内存五列，且状态为 Ready 或 NotReady。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认节点是否就绪、还剩多少资源 (Priority: P1)

作为 **集群管理员**，我希望 **一眼看到每个节点的就绪状态与可分配资源**，以便 **判断能否继续调度**。

**Independent Test**：打开节点页，核对状态徽章与 `kubectl get nodes` 的 STATUS 列一致。

## 前置与配置

- 已登录，且有集群权限
- 集群内至少有一个节点

## 测试步骤

1. 打开节点页
2. 核对表头
3. 读取第一行的状态徽章
4. 用 API 核对节点数

## 期望结果

- 表头依次为 名称、状态、角色、CPU、内存
- 状态为 Ready 或 NotReady 或 Unknown
- 行数与 API 返回的节点数一致

## 失败排查

- 状态与 kubectl 不一致时看 nodeStatus 的 Ready 条件判断
- 角色为空时看 nodeRole 的缺省值

## 产品改版后如何更新自动化

- 节点列变化时改 pages/cluster_management.py
