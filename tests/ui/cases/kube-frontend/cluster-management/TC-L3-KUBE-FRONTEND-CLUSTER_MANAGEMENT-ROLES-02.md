# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02 平台角色页多集群切换（成员集群只读）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `roles`
- **入口**: `{BASE_URL}/kube-frontend/access/clusterroles`
- **需求**: `prd/kube-frontend/cluster-management/roles.md`

## 产品功能

平台「集群角色」页增加集群选择器：host 保持可写平台列表；切到成员集群时显示该集群的角色只读列表（复用集群作用域角色页），隐藏创建/编辑/删除，并说明写操作在集群控制台。

### 关联需求

- `prd/kube-frontend/cluster-management/roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/roles.md`](../../../../prd/kube-frontend/cluster-management/roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02** — Given 多集群安装且集群数 >1，When 打开 /kube-frontend/access/clusterroles，Then 顶部显示集群选择器并列出 host 与成员集群；选择成员集群后显示该集群的角色列表（来自 /kapis/clusters/<c>/iam…）、只读提示，且没有创建角色入口；切回 host 后平台角色列表与创建按钮恢复。Given 单集群部署，Then 不显示选择器，页面行为与原来一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/roles.md`](../../../../design/kube-frontend/cluster-management/roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/roles.md`](../../../../prd/kube-frontend/cluster-management/roles.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 在平台角色页切换查看成员集群角色 (Priority: P2)

作为 **平台管理员**，我希望 **在平台「集群角色」页切换 host / 成员集群查看该集群的角色**，以便 **不用逐个进入集群控制台也能核对各集群有哪些角色**。

**Independent Test**：多集群安装打开 /access/clusterroles，选择器列出 host 与成员；切到成员后显示该集群角色（只读、无创建入口）；切回 host 后平台角色列表与创建按钮恢复。

## 前置与配置

- 多集群安装（host + 至少一个成员集群），admin 登录；成员集群 IAM 可读
- 用例不改动任何角色

## 测试步骤

1. 打开 /kube-frontend/access/clusterroles，确认集群选择器可见且含 host 与成员集群
2. 选择成员集群，断言只读提示出现、集群作用域角色列表加载、行集合与成员集群 clusterroles API 一致、没有创建角色按钮
3. 切回 host，断言平台角色列表与创建按钮恢复

## 期望结果

- 选择器仅在集群数 >1 时显示
- 成员视图使用 /kapis/clusters/<c>/iam… 读取；写入口隐藏
- host 视图行为与原平台角色页一致（可写）

## 失败排查

- 选择器不出现：确认 clusters 接口返回 >1 个集群
- 成员列表串成 host 数据：确认路径含 /clusters/<c>/iam…

## 产品改版后如何更新自动化

- 句柄：clusterroles:cluster（选择器）、clusterroles:create、clusterroles:member-readonly、cluster-roles:surface/table
