# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02 集群网关 · 双页签各自的显示列

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-gateways`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways`
- **需求**: `prd/kube-frontend/cluster-management/cluster-gateways.md`

## 产品功能

集群网关页的两个页签（集群网关 / 项目网关）各自提供「显示列」，选择按页签分别持久化，互不影响。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-gateways.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-gateways.md`](../../../../prd/kube-frontend/cluster-management/cluster-gateways.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02** — 已知集群网关页的「集群网关」与「项目网关」两个页签各自是多列表格，当点某个页签的「显示列」，则只列出该页签 schema 的可隐藏列（名称不可隐藏）；取消勾选后该页签表头立即消失，选择按页签分别持久化（`kube-frontend.columns.cluster-gateways:{cluster,project}`）、两个页签互不影响，「重置」恢复该页签全部列。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-gateways.md`](../../../../design/kube-frontend/cluster-management/cluster-gateways.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-gateways.md`](../../../../prd/kube-frontend/cluster-management/cluster-gateways.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 判断集群与项目网关是否就绪 (Priority: P1)

作为 **集群管理员**，我希望 **查看不同作用域的网关状态**，以便 **判断路由是否具备访问入口**。

**Independent Test**：打开集群和项目网关两个视图，对账接口对象；无对象时显示空态，有对象时状态取控制器条件。

## 前置与配置

- 已登录；集群 host 有网关数据

## 测试步骤

1. 打开集群网关页，核对默认页签的显示列菜单
2. 在「集群网关」页签取消勾选一列，核对表头减一并持久化
3. 切到「项目网关」页签，核对它的选择未受影响（表头数不变）
4. 在项目网关页签取消一列，核对两个页签的存储键不同

## 期望结果

- 两个页签分别有 cluster-gateways:{cluster,project}:columns 触发器
- 各页签的菜单只列该 schema 的可隐藏列（名称不可隐藏）
- 取消勾选只影响当前页签；存储键分别为 kube-frontend.columns.cluster-gateways:{cluster,project}

## 失败排查

- 两个页签互相影响：存储键没有带页签名
- 菜单只有「重置」：该 schema 的列没有标 hideable

## 产品改版后如何更新自动化

- 句柄：cluster-gateways:tab:{cluster,project} / cluster-gateways:{cluster,project}:columns / :columns:<key> / :columns:reset
