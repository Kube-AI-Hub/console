# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01 项目角色 · 列表列与模板徽标

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `roles`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles`
- **需求**: `prd/kube-frontend/project-settings/roles.md`

## 产品功能

['角', '色', '列', '表', '显', '示', '名', '称', '、', '规', '则', '数', '、', '创', '建', '时', '间', '，', '模', '板', '角', '色', '带', '徽', '标', '。']

### 关联需求

- `prd/kube-frontend/project-settings/roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01** — 已知项目内至少有一个角色，当打开角色列表，则显示名称、规则数、创建时间三列，且 `role-template-*` 的行带「模板」徽标。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/roles.md`](../../../../design/kube-frontend/project-settings/roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些角色、各有多少规则 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到规则数与是否模板**，以便 **判断哪些是可分配的角色**。

**Independent Test**：打开角色列表，核对列与模板徽标。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该项目内至少有一个角色（含 role-template-* 模板角色）

## 测试步骤

1. 打开项目角色页
2. 核对表头
3. 找到一个 role-template-* 角色并核对其徽标

## 期望结果

- 表头依次为 名称、规则数、创建时间
- 模板角色行显示「模板」徽标
- 规则数为数字

## 失败排查

- 缺列时看 SettingsListPage 的 columns
- 徽标缺失时看 isTemplateRole 的判定

## 产品改版后如何更新自动化

- 列变化时改 pages/project_settings.py 的 headers 断言
