# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03 租户(企业空间)成员 · 详情属性与项目/DevOps 页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-members`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{workspace}/members/{name}`
- **需求**: `prd/kube-frontend/access-control/workspace-members.md`

## 产品功能

成员详情展示租户(企业空间)、角色、邮箱；项目页签可读；DevOps 未部署时为空态而不是整页错误。

### 关联需求

- `prd/kube-frontend/access-control/workspace-members.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-members.md`](../../../../prd/kube-frontend/access-control/workspace-members.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03** — 已知某成员存在，当打开其详情，则展示租户(企业空间)、租户(企业空间)角色、邮箱；项目页签列出该成员可访问的项目（名称可点进项目控制台）或明确空态；DevOps 页签在接口 404 时为空态而非整页错误；非本人可从详情移除绑定。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-members.md`](../../../../design/kube-frontend/access-control/workspace-members.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-members.md`](../../../../prd/kube-frontend/access-control/workspace-members.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 看清一名成员能进哪些项目 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **打开成员详情看到其空间角色、邮箱，以及可访问的项目和 DevOps 工程**，以便 **交接时知道对方实际能进哪里**。

**Independent Test**：打开 `/workspaces/<ws>/members/<name>`，核对租户(企业空间)/角色/邮箱；项目页签列出该用户的 namespaces（或空态）；DevOps 页签在模块未部署时显示空态而不是整页错误。

## 前置与配置

- 已登录且有成员读写权限
- 空间至少有一个可分配角色
- 仅操作唯一命名的一次性测试用户

## 测试步骤

1. 创建一次性平台账号并写入空间成员
2. 打开 /workspaces/<ws>/members/<name>
3. 核对基本信息含租户(企业空间)、租户(企业空间)角色、邮箱
4. 项目页签可见（表格或空态）
5. 切到 DevOps 工程页签，页面不是 error

## 期望结果

- 详情 surface 为 ready
- 角色与邀请时写入的 workspacerole 一致
- DevOps 页签不把整页打成 error
- finally 解绑并删除测试账号

## 失败排查

- 整页 error 且 URL 含 devops：404 被当成致命错误，应在 api-client 里当空集合
- 角色为 -：GET 成员对象没带 iam.kubesphere.io/workspacerole

## 产品改版后如何更新自动化

- 选择器见 WorkspaceMemberDetailPage.tsx 的 workspace-member-detail:*
