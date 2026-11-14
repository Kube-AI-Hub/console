# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01 项目角色详情 · 权限规则与已授权用户页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `role-detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles/viewer`
- **需求**: `prd/kube-frontend/project-settings/role-detail.md`

## 产品功能

项目角色详情的只读两个页签：权限规则（默认）与已授权用户（该角色 RoleBinding 的 subjects）。

### 关联需求

- `prd/kube-frontend/project-settings/role-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/role-detail.md`](../../../../prd/kube-frontend/project-settings/role-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01** — 已知项目 `<ns>` 的角色 `<name>` 有 R 条规则、它的 RoleBinding 共含 S 个 subject（R、S 可能为 0），当从角色列表进入该角色详情，则默认显示「权限规则」页签并列出 R 行（API 组 / 资源 / 动作）；切换到「已授权用户」页签后列出 S 行（类型 / 名称 / 命名空间），User 类型主体可跳转到用户详情；S 为 0 时显示「该角色还没有授权给任何账号」；绑定接口失败时该页签显示「授权信息不可用」与重试，而不是空态；页面只读。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/role-detail.md`](../../../../design/kube-frontend/project-settings/role-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/role-detail.md`](../../../../prd/kube-frontend/project-settings/role-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 项目管理员核对角色权限与已授权主体 (Priority: P1)

作为 **项目管理员**，我希望 **打开一个项目角色，能在「权限规则」和「已授权用户」两个页签之间切换**，以便 **确认这个角色允许什么、以及它当前被谁（用户/服务账号）持有**。

**Independent Test**：从项目角色列表点击角色名进入详情，规则页签行数等于角色对象 `rules` 长度；切到「已授权用户」页签，行数等于该角色全部 RoleBinding subjects 数；没有绑定时显示明确空态。

## 前置与配置

- 已登录，且 default 项目存在可读的角色
- 该项目的 rolebindings 可读（可能没有绑定）

## 测试步骤

1. 用 API 读 default 项目角色列表，选一个有 RoleBinding 的角色（没有则取第一个角色）
2. 用 API 读 /apis/rbac.authorization.k8s.io/v1/namespaces/default/rolebindings，按 roleRef.name 过滤并展开 subjects 得到期望行数 S
3. 用 API 读角色详情得到 rules 数组（期望规则行数 R）
4. 打开项目角色列表，点击角色名链接进入详情
5. 核对默认「权限规则」页签的规则表行数
6. 点击「已授权用户」页签，核对表头与行数；无绑定时核对空态

## 期望结果

- 详情 surface 可见且 data-ai-state 为 ready
- 规则行数等于 R（R 为 0 时显示无规则说明）
- 已授权用户页签表头为 类型 / 名称 / 命名空间
- 有绑定：行数等于 S，首行出现 project-role-detail:user:<name> 句柄
- 无绑定：显示 project-role-detail:users-empty
- 全程不发出写请求

## 失败排查

- 已授权用户恒空：读了 users?role= 而不是 namespaced rolebindings（会漏 ServiceAccount 主体）
- 行数大于接口：没按 roleRef.name 过滤
- 页面 404：roles/$name.tsx 路由未建或缺 workspace/cluster/project 段
- 用户链接 404：只对 kind=User 的主体生成 /kube-frontend/access/users/<name> 链接

## 产品改版后如何更新自动化

- 选择器：project-role-detail:link:<name> / tab:rules / tab:users / rule-table / user-table / users-empty / user:<name>
