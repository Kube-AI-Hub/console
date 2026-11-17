# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01 集群作用域角色列表与详情（规则 / 已授权用户）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `roles`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{KA_CLUSTER}/roles`
- **需求**: `prd/kube-frontend/cluster-management/roles.md`

## 产品功能

集群作用域角色页：列表（名称/系统徽标/规则数/创建时间），详情两页签（权限规则、已授权用户）；角色读当前集群的 IAM 集合；只读。

### 关联需求

- `prd/kube-frontend/cluster-management/roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/roles.md`](../../../../prd/kube-frontend/cluster-management/roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01** — 已知集群有 R 个 clusterrole，当打开该集群角色页，则列出 R 行，每行显示名称（系统角色带「系统」徽标）、规则数（rules 长度，可为 0）、创建时间；R 为 0 时空态，接口失败时错误面板与重试。点击名称进入详情，默认「权限规则」页签按 API 组/资源/动作逐条列出 rules；切到「已授权用户」页签列出直接绑定该角色的 IAM 用户（用户名/状态/最近登录）；没有直接绑定时给出明确空态。页面只读，不提供创建/编辑/删除。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/roles.md`](../../../../design/kube-frontend/cluster-management/roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/roles.md`](../../../../prd/kube-frontend/cluster-management/roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群控制台核对角色与授权 (Priority: P2)

作为 **集群管理员**，我希望 **在某个集群的上下文里看到该集群的角色、规则与直接授权的用户**，以便 **不用切到平台访问控制页（且只看到 host）也能回答「这个集群里谁能做什么」**。

**Independent Test**：进入 /clusters/host/roles，列表行数与接口 totalItems 一致；进入任一带规则的角色详情，规则行数等于对象 rules 长度；已授权用户页签与 /users?clusterrole=<name> 一致（无绑定时显示空态）。

## 前置与配置

- 已登录 admin；host 集群有 218 个 clusterrole，且至少一个 ClusterRoleBinding 绑定到 User
- 用例不改动集群数据

## 测试步骤

1. 打开 /clusters/host/roles，核对行数 >0、规则数列与接口一致
2. 通过 API 选一个有 User 主体的 ClusterRoleBinding 的角色，进入其详情
3. 默认权限规则页签：行数等于该角色 rules 数组长度，列头为 API 组/资源/动作
4. 切到已授权用户：包含绑定中的用户名；空绑定角色显示空态
5. 返回列表，核对系统角色有「系统」徽标

## 期望结果

- 列表来自 /kapis/iam…/clusterroles?limit=-1；行数与 totalItems 一致
- 详情规则行数 = rules.length；用户行来自 /kapis/iam…/users?clusterrole=<name>
- 系统角色（role-template-*）带徽标；页面只读（无创建/删除入口）

## 失败排查

- 规则数不一致：确认详情读的是同一对象，规则按 rule 条目计
- 用户页签为空：确认查询参数是 clusterrole=<对象名>，且绑定主体为 User

## 产品改版后如何更新自动化

- 句柄：cluster-roles:surface/table/name:<name>；cluster-role-detail:surface/rules/rule:<i>/tab:rules/tab:users/users/user:<name>/rules-empty/users-empty/retry
