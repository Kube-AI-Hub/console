# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02 项目角色 · 编辑信息与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `roles`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles`
- **需求**: `prd/kube-frontend/project-settings/roles.md`

## 产品功能

非模板角色的行操作提供「编辑信息」与「删除」；编辑写别名注解，删除后对象不存在。

### 关联需求

- `prd/kube-frontend/project-settings/roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02** — 已知角色列表中有一个非模板角色，当「编辑信息」并填写别名，则该角色的 `kubesphere.io/alias-name` 注解被更新；当「删除」并确认，则该角色从列表消失且 API 返回 404。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/roles.md`](../../../../design/kube-frontend/project-settings/roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些角色、各有多少规则 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到规则数与是否模板**，以便 **判断哪些是可分配的角色**。

**Independent Test**：打开角色列表，核对列与模板徽标。

## 前置与配置

- 由夹具通过原生 RBAC 创建一个 tc-e2e- 项目角色，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开角色列表并定位该角色
2. 行操作「编辑信息」，填写别名并确认
3. 用 API 读取注解
4. 行操作「删除」并确认，读取状态码

## 期望结果

- 别名写入 kubesphere.io/alias-name 注解
- 删除后 GET 返回 404

## 失败排查

- 别名未变时确认写的是 metadata.annotations
- 删除按钮不出现说明被当成模板角色

## 产品改版后如何更新自动化

- 行操作变化时改 pages/project_settings.py
