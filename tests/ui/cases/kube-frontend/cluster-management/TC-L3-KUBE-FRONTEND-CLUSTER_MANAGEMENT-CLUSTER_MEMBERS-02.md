# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02 集群成员 · 邀请、改角色与移除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-members`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/members`
- **需求**: `prd/kube-frontend/cluster-management/cluster-members.md`

## 产品功能

集群成员页可邀请平台用户并授予集群角色、修改角色、移除成员（单条与批量）；当前登录账号不可操作自己，且不可勾选。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-members.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-members.md`](../../../../prd/kube-frontend/cluster-management/cluster-members.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02** — 已知当前身份可写集群成员，当点「邀请成员」填平台用户名并选择集群角色后提交，则发出 `POST /kapis/iam.kubesphere.io/v1alpha2/clustermembers`（body 为 `[{username, roleRef}]` 数组），成功后列表出现该账号且其 `iam.kubesphere.io/clusterrole` 注解等于所选角色；当对一行点「修改角色」并保存，则发出 `PUT …/clustermembers/<username>` 且回读注解更新；当点「移除」并输入用户名确认（或勾选多行批量移除），则发出 `DELETE …/clustermembers/<username>` 且集合不再包含该账号；当前登录账号所在行显示「当前账号」，**不渲染复选框，也不渲染改角色/移除入口**；用户名留空或不符合 `^[a-z0-9]([-a-z0-9.]*[a-z0-9])?# 集群成员（L3）

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-members.md`](../../../../design/kube-frontend/cluster-management/cluster-members.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-members.md`](../../../../prd/kube-frontend/cluster-management/cluster-members.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 授予、调整与收回集群角色 (Priority: P1)

作为 **集群管理员**，我希望 **直接把一个平台账号加进集群并给它一个集群角色，事后能改角色或移除它**，以便 **不必手写 ClusterRoleBinding**。

**Independent Test**：邀请一个账号 → 成员集合出现该账号且角色注解与所选一致；改角色后回读为新角色；移除后集合不再包含它。

## 前置与配置

- 已登录为 admin；集群存在至少一个可分配集群角色（cluster-viewer/cluster-admin）

## 测试步骤

1. 用 API 创建一个唯一命名的平台用户（前缀 tc-e2e-cm-）
2. 打开集群成员页，点「邀请成员」，填用户名并选择集群角色后提交
3. 核对新行出现、角色列与回读的 iam.kubesphere.io/clusterrole 一致
4. 行操作「修改角色」改成另一个角色并保存，回读一致
5. 行操作「移除」，输入用户名确认，核对行消失且 clustermembers 回读 404
6. 核对当前登录账号那一行没有复选框、没有改角色/移除入口

## 期望结果

- 邀请发出 POST /kapis/iam.kubesphere.io/v1alpha2/clustermembers（数组 body）并成功
- 改角色发出 PUT …/clustermembers/<username>，回读注解为所选角色
- 移除发出 DELETE …/clustermembers/<username>，集合不再包含该用户
- 自己的行显示「当前账号」说明，且 input[type=checkbox] 与改角色/移除按钮都不存在
- 用户名为空或非法时本地拒绝，不发请求

## 失败排查

- 邀请 404：端点用了 /clusters/<c>/members 或 /apis 路径；正确是 kapis 的 clustermembers 集合
- 改角色无效：用了 PATCH 或 POST，正确是 PUT 对象路径

## 产品改版后如何更新自动化

- 句柄：cluster-members:surface / :invite / :invite-dialog / :invite-username / :invite-role / :invite-submit / :change-role / :role-dialog / :role-select / :role-submit / :remove / :remove-dialog / :remove-confirm-input / :remove-confirm / :self
