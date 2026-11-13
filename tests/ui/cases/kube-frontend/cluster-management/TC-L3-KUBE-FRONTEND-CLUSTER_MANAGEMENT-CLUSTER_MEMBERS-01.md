# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01 集群成员 · 谁持有集群角色

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-members`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/members`
- **需求**: `prd/kube-frontend/cluster-management/cluster-members.md`

## 产品功能

集群设置下的集群成员页：用户名、状态、集群角色、最近登录四列；只读。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-members.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-members.md`](../../../../prd/kube-frontend/cluster-management/cluster-members.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01** — 已知集群有成员，当打开集群成员页，则显示用户名、状态、集群角色、最近登录四列；行数等于 clustermembers 接口返回数；角色列等于该账号的 iam.kubesphere.io/clusterrole 注解；最近登录等于 status.lastLoginTime；没有成员时显示空态。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-members.md`](../../../../design/kube-frontend/cluster-management/cluster-members.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-members.md`](../../../../prd/kube-frontend/cluster-management/cluster-members.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清谁能管理这个集群 (Priority: P1)

作为 **集群管理员**，我希望 **在一页看到所有持有集群角色的账号**，以便 **回答「除了我还有谁能改这个集群」**。

**Independent Test**：打开集群成员页，核对行数等于 clustermembers 接口返回数，角色列等于账号的 iam.kubesphere.io/clusterrole 注解。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群至少有一个成员（通常有 admin）

## 测试步骤

1. 用 API 读取 clustermembers
2. 打开集群成员页
3. 核对四列与行数
4. 核对首个成员的角色与注解一致

## 期望结果

- 页可达且 ready
- 行数等于接口返回数
- 集群角色列等于 iam.kubesphere.io/clusterrole 注解

## 失败排查

- 行数为 0：读的是 clusterrolebindings（404）而不是 clustermembers
- 角色列为空：注解键写成 globalrole
- 侧栏没有入口：registry 未注册（注意项目级 members 已存在）

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterMembersPage.tsx
