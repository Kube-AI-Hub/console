# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01 DevOps 成员 · 列表、邀请、改角色与移除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-members`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

成员页签的列与空态、邀请对话框的用户名必填校验与预置角色选项、邀请/改角色/移除三步真实写接口并回读；只用专用测试账号 ui-test，finally 清理绑定。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01** — Given 打开成员页签，Then 表格列为 用户名 / 角色 / 状态 / 最近登录 / 操作，无成员显示「该工程还没有成员。」，最近登录为空显示「尚未登录」；点邀请打开对话框，用户名为空提交被校验拦下并提示，角色下拉只列预置角色 viewer / operator / admin；成员读取失败显示失败原因与重试。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-02** — Given 邀请对话框，When 填平台已有用户名并选 viewer 提交，Then 发出 POST `/kapis/iam.kubesphere.io/v1alpha2/devops/<name>/members`（数组 body），成功后行出现且角色为 viewer；点修改角色选 operator 保存，发出 PUT `…/members/<username>` 且行角色更新；点移除并在确认框确认，发出 DELETE `…/members/<username>` 且行消失；失败显示服务端消息。 成员列表对**当前登录账号自己**这一行不渲染「修改角色 / 移除」，改显示「不能修改自己的角色或移除自己」（旧 console 的 showAction 保护；服务端也会拒绝对自己改角色或移除）。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US11 - 管理工程成员 (Priority: P1)

作为 **DevOps 使用者**，我希望 **在成员页签看到用户名 / 角色 / 状态 / 最近登录，邀请平台用户加入工程并指定预置角色，修改成员角色，移除成员**，以便 **在不切旧控制台的情况下维护工程协作者**。

**Independent Test**：打开成员页签，无成员时显示空态；点邀请，用户名为空时提交被校验拦下；填平台已有用户名并选择 viewer 提交，行出现且角色为 viewer；点修改角色改为 operator，行角色更新；点移除并确认，行消失并回到空态。

## 前置与配置

- 已登录且存在含命名空间的 DevOps 工程；不存在时 skip
- 使用平台测试账号 ui-test（不是当前登录账号），finally 移除该成员绑定
- 绝不修改 admin 或当前登录账号的成员关系

## 测试步骤

1. 接口读 members，若 ui-test 已存在先移除（自清理）
2. 打开成员页签，核对表头与空态或行
3. 点邀请，空用户名提交核对校验提示；打开角色下拉核对只有 viewer/operator/admin
4. 填 ui-test 选 viewer 提交，核对行出现、角色 viewer 与接口注解
5. 点修改角色选 operator 保存，核对行角色与接口
6. 点移除、输入用户名确认，核对行消失与接口无该成员

## 期望结果

- 表头为 用户名/角色/状态/最近登录/更多操作；无成员显示「该工程还没有成员。」，最近登录为空显示「尚未登录」
- 空用户名提交显示「请输入用户名。」且不发请求；角色下拉仅 viewer/operator/admin
- 邀请成功后行出现且角色为 viewer；接口 members 返回该用户且 iam.kubesphere.io/role=viewer
- 修改角色后行角色为 operator；接口回读 role=operator
- 移除后行消失；接口 members 不再返回该用户

## 失败排查

- 邀请 400：用户名必须是平台已有用户（ui-test 已存在）
- 行不刷新：写后需要 invalidate members 查询
- 误操作自己：新实现未迁移旧 console 的自我保护，测试只用 ui-test

## 产品改版后如何更新自动化

- 选择器：devops-detail:tab:members、members-invite、devops:member-invite-username/-role/-submit、member-role:<name>、devops:member-role-select/-submit、member-remove:<name>、delete-input/delete-confirm
- 账号或角色文案变化时同步 pages/devops_page.py
