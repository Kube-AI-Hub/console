# 集群切换与作用域侧栏（L3）

[子模块需求](./_index.md)

## 概述

进入某个集群后，左侧导航显示该集群的菜单，并在顶部提供**集群切换器**；平台页的左侧导航显示
平台级入口。三者按作用域切换，不再出现「平台页显示项目菜单」。

## 用户故事

### US1 - 在集群之间直接切换 (Priority: P1)

作为 **平台管理员**，我希望 **在集群控制台里直接切到另一个集群**，以便 **比较或处理多个集群而不必回到列表重新找**。

**Independent Test**：在 `host` 概览点击侧栏顶部切换器，选择另一个集群；地址变为该集群的概览，切换器显示新集群名；再切回 `host`。

### US2 - 左侧导航始终对应当前作用域 (Priority: P1)

作为 **读者**，我希望 **左侧导航显示当前作用域的菜单**，以便 **不会在平台页被带进某个项目**。

**Independent Test**：访问 `/clusters`、`/access/users`、`/clusters/<id>/nodes`，三处侧栏分别为平台导航、平台导航、集群菜单，且当前项高亮。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01** — 在集群概览点击切换器选择另一集群，则跳转到该集群的 `/overview`，切换器显示新集群，集群菜单高亮「集群概览」；可切回原集群。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02** — 平台页（`/clusters`、`/access`）侧栏为平台导航且不含项目区条目、当前项高亮；集群页侧栏为集群菜单且不含项目区条目，同时显示切换器。

## 设计目标

作用域决定侧栏：项目 → 项目区；集群 → 集群菜单 + 切换器；平台 → 平台入口。

## 约束与边界

- 切换统一落到目标集群的概览：并非每个集群都装了每个模块。
- 记忆最后访问的集群（按用户名），用于构造「无集群段」的链接。
- 单集群安装不显示切换入口，且 `/clusters` 直接进入该集群概览。

## UI 交互设计

- 切换器位于侧栏顶部：集群图标 + 当前集群（别名优先）+「集群」说明 + 折叠箭头。
- 点击打开对话框：搜索框 + 集群列表（别名/名称、版本、节点数、就绪状态）。
- 选择后整页跳转（与老 console 的 `enterCluster` 一致）。

## 文案与校验

- 「当前集群」「切换集群」「暂无其他集群」等。

## 边界情况

- 目标集群未就绪：仍然可切换，页面据实显示未就绪原因。
- 只有一个集群：切换器可见但列表仅一项。
- 配置读取失败：按多集群处理（保持切换器可用）。

## 明确不做

- 在切换器里添加/编辑集群（那是列表页的职责）。
- 跨集群聚合视图。

## 假设

- 平台以 `configz.multicluster` 表明多集群能力。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01** — 集群页侧栏顶部提供切换器，选择后到目标集群概览并记住选择。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02** — 侧栏按作用域渲染并高亮当前项。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01** — 三个作用域的侧栏内容与高亮均可被用例核对。
