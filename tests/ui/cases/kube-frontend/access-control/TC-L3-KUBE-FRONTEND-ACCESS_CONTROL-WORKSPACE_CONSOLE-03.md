# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03 企业空间控制台 · 角色列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/roles`
- **需求**: `prd/kube-frontend/access-control/workspace-roles.md`

## 产品功能

企业空间独立作用域：角色页列出工作空间作用域的 WorkspaceRole，含规则数与创建时间。

### 关联需求

- `prd/kube-frontend/access-control/workspace-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-roles.md`](../../../../prd/kube-frontend/access-control/workspace-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03** — 已知企业空间内有 R 个 WorkspaceRole（R 可能为 0），当打开该空间角色页，则列出 R 行，每行显示名称（有别名时显示别名并附对象名）、规则数（`rules` 长度，可为 0）、创建时间；R 为 0 时显示空态；接口失败时显示错误面板与重试。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-roles.md`](../../../../design/kube-frontend/access-control/workspace-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-roles.md`](../../../../prd/kube-frontend/access-control/workspace-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员核对可分配角色 (Priority: P1)

作为 **企业空间管理员**，我希望 **看到该空间全部角色、规则数与创建时间**，以便 **在给成员分配角色前确认每个角色授予的权限规模**。

**Independent Test**：打开 `/workspaces/<ws>/roles`，核对行数与接口返回的 `totalItems` 一致；某个已知角色行的「规则数」等于该对象 `rules` 数组长度。

## 前置与配置

- 已登录，且能看到至少一个企业空间
- 该企业空间的 workspaceroles 集合可读（可能为 0 个角色）

## 测试步骤

1. 用 API 读企业空间列表，优先选有角色的空间
2. 读 /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles?limit=-1 得到期望行数 R
3. 打开该空间的 /roles 页
4. 等待 surface 离开 loading
5. 核对表头三列与行数；R 为 0 时核对空态

## 期望结果

- surface 可见且 data-ai-state 从 loading 变为 ready 或 empty
- 表头含 名称 / 规则数 / 创建时间
- 行数等于 R（超过 20 行时为第一页 20 行）
- R 为 0 时表格为空态，页面不报错

## 失败排查

- 行数比预期多：读了平台级 /workspaceroles 且没按 label 过滤，必须用工作空间作用域路径
- 规则数全是 0：rules 来自对象顶层字段，不是 metadata
- created 列显示带 T/Z 的原始串：忘了 formatTimestamp

## 产品改版后如何更新自动化

- 选择器：pages/access_control.py（origin 拼接）、WorkspaceRolesPage.tsx 的 workspace-roles:surface
