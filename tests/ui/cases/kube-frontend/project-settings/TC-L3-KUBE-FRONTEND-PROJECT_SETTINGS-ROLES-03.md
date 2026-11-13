# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-03 项目角色 · 模板角色只读

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `roles`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles`
- **需求**: `prd/kube-frontend/project-settings/roles.md`

## 产品功能

role-template-* 角色的行操作只提供「详情」，不提供编辑、编辑权限与删除。

### 关联需求

- `prd/kube-frontend/project-settings/roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-03** — 已知列表中有 `role-template-*` 角色，当打开其行操作，则只提供「详情」，不提供编辑与删除（平台拒绝写模板角色）。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/roles.md`](../../../../design/kube-frontend/project-settings/roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些角色、各有多少规则 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到规则数与是否模板**，以便 **判断哪些是可分配的角色**。

**Independent Test**：打开角色列表，核对列与模板徽标。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该项目至少有一个 role-template-* 角色

## 测试步骤

1. 打开角色列表并搜索一个 role-template-* 角色
2. 打开其行操作菜单

## 期望结果

- 菜单只有「详情」，没有「编辑信息」「编辑权限」「删除」

## 失败排查

- 出现编辑/删除说明 system 判定失效（isTemplateRole）
- 找不到模板角色时用例跳过

## 产品改版后如何更新自动化

- 模板判定规则变化时改 api-client 的 isTemplateRole
