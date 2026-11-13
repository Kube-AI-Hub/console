# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02 企业空间详情 · 成员与角色

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-detail`
- **入口**: `{BASE_URL}/kube-frontend/access/workspaces`
- **需求**: `prd/kube-frontend/access-control/workspace-detail.md`

## 产品功能

企业空间详情展示成员：用户名、企业空间角色、状态；条数等于 workspacemembers 接口返回数。

### 关联需求

- `prd/kube-frontend/access-control/workspace-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-detail.md`](../../../../prd/kube-frontend/access-control/workspace-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02** — 已知企业空间有成员，当打开企业空间详情，则「成员」区块逐条列出用户名、企业空间角色与状态，条数等于 `/kapis/iam.kubesphere.io/v1alpha2/workspaces/<名称>/workspacemembers` 返回条数；没有成员或接口不可用时显示说明而非空表。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-detail.md`](../../../../design/kube-frontend/access-control/workspace-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-detail.md`](../../../../prd/kube-frontend/access-control/workspace-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 看清这个企业空间里谁能进 (Priority: P1)

作为 **平台管理员**，我希望 **在企业空间详情看到成员与他们的企业空间角色**，以便 **在交接或审计时知道谁能进入这个租户**。

**Independent Test**：打开企业空间详情，核对成员条数等于 workspacemembers 接口返回数，角色列等于 `iam.kubesphere.io/workspacerole` 注解。

## 前置与配置

- 已登录平台管理
- 平台上至少有一个企业空间且其有成员

## 测试步骤

1. 用 API 读取企业空间列表与第一个企业空间的 workspacemembers
2. 打开该企业空间详情
3. 核对成员区块条数与角色列

## 期望结果

- 成员条数等于 workspacemembers 返回条数
- 角色列等于 iam.kubesphere.io/workspacerole 注解

## 失败排查

- 成员区块显示不可用：读了 tenant 的 /workspaces/<ws>/members（404），应读 iam 的 /workspaces/<ws>/workspacemembers
- 角色为空：注解键写成 workspacerole 之外的名字

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 WorkspaceDetailPage.tsx
