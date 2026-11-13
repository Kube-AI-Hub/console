# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-04 项目角色 · 从模板创建角色

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `roles`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles`
- **需求**: `prd/kube-frontend/project-settings/roles.md`

## 产品功能

从项目角色页创建角色：选择平台模板，复制其规则；创建后角色在原生 RBAC 与 kapis 读取中都有规则。

### 关联需求

- `prd/kube-frontend/project-settings/roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-04** — 已知项目内有可用的 `role-template-*` 模板角色，当点「创建角色」、填写合法名称并选择一个模板后提交，则项目中出现该角色，其 `rules` 条数等于所选模板的 `rules` 条数，别名写入 `kubesphere.io/alias-name`；该角色可被删除。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/roles.md`](../../../../design/kube-frontend/project-settings/roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 从模板创建一个项目角色 (Priority: P1)

作为 **项目管理员**，我希望 **以平台模板为基础创建本项目自己的角色**，以便 **不用从零写权限规则**。

**Independent Test**：选一个模板创建角色 → 回读该角色的 `rules` 条数等于模板条数 → 删除。

## 前置与配置

- 已登录，且对 default 项目有管理权限
- 项目内存在 role-template-* 模板角色
- 用例使用 tc-e2e- 前缀名称，finally 中删除

## 测试步骤

1. 打开项目角色页，点「创建角色」
2. 填名称并选择一个模板角色
3. 提交
4. 用原生 RBAC 接口回读该角色的 rules 条数
5. 用 kapis 回读别名注解
6. 删除该角色

## 期望结果

- 创建成功，角色出现在列表
- rules 条数等于所选模板的 rules 条数（不是 0）
- 别名写入 kubesphere.io/alias-name

## 失败排查

- rules 为 0：创建走了 kapis 而不是原生 RBAC（kapis 会丢 rules）
- 创建 422：名称不合法或模板未选
- 列表不刷新：失效键应为 ['settings','roles']

## 产品改版后如何更新自动化

- 选择器见 pages/project_settings.py 与 RoleCreateDialog.tsx
