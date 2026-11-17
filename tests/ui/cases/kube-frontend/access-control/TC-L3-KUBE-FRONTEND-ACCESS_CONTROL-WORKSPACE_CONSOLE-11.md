# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11 企业空间角色写能力：创建、编辑信息/权限、模板只读、删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{KA_WORKSPACE}/roles`
- **需求**: `prd/kube-frontend/access-control/workspace-roles.md`

## 产品功能

企业空间角色页支持创建自定义角色（聚合平台权限模板）、编辑别名/描述、编辑权限（替换模板集合）、删除；平台维护（creator=system）与 role-template-* 角色只读；写成功后回读集合，失败保留弹窗与原因。

### 关联需求

- `prd/kube-frontend/access-control/workspace-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-roles.md`](../../../../prd/kube-frontend/access-control/workspace-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11** — Given 打开企业空间角色页，When 点「创建角色」填合法名称、别名并勾选至少一个权限模板后提交，Then 发出 POST /kapis/iam.kubesphere.io/v1alpha2/workspaces/<ws>/workspaceroles，body 含 rules: [] 与 aggregation-roles 注解（模板名 JSON 数组）；成功后列表出现该角色且规则数由服务端聚合为非空。名称为空/非法或未选模板时提交被拦下并显示提示。When 行操作编辑信息（merge-patch 只发 annotations，清空键 null）或编辑权限（只替换 aggregation-roles），Then 回读注解/规则一致。平台维护（creator=system）与 role-template-* 角色不显示写入口；删除需输入角色名确认，成功后对象从接口与列表消失。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-roles.md`](../../../../design/kube-frontend/access-control/workspace-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-roles.md`](../../../../prd/kube-frontend/access-control/workspace-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 维护自定义企业空间角色 (Priority: P2)

作为 **企业空间管理员**，我希望 **从平台权限模板组合出本空间的自定义角色，并能改别名/描述、调整模板集合、删除不再需要的角色**，以便 **按团队职责授权，而不用去平台权限里拼角色**。

**Independent Test**：创建一次性角色（勾选两个模板）→ 接口中角色存在且规则已由平台聚合；改别名后回读一致；编辑权限替换模板集合后规则数与内容变化；平台模板/预置角色行没有写入口；删除需输入角色名，确认后接口 404。

## 前置与配置

- 已登录，admin；企业空间 system-workspace 存在且可写工作空间角色
- 用例自建唯一角色并在 finally 删除；不修改平台模板与预置角色

## 测试步骤

1. 打开角色页，点「创建角色」，填名称、别名，勾选两个权限模板后提交
2. 轮询 API 核对角色存在、aggregationRoles 注解含所选模板、rules 已由服务端聚合非空
3. 行操作「编辑信息」改别名/描述并提交；回读注解
4. 行操作「编辑权限」替换模板集合（取消一个、勾选另一个）并提交；回读 aggregationRoles 与 rules 变化
5. 打开平台维护角色（system-workspace-admin）行菜单，确认没有「编辑信息 / 编辑权限 / 删除」（模板角色在本部署不显示于普通列表，按 creator=system 同一规则隐藏）
6. 行操作「删除」，输入角色名确认；API 404，列表移除

## 期望结果

- create 请求 POST /kapis/iam…/workspaces/<ws>/workspaceroles，body 含 rules: [] 与 aggregation-roles JSON
- 编辑信息为只含 annotations 的 merge-patch（清空键 null）；编辑权限只替换 aggregation-roles
- 平台角色/模板角色无写操作入口
- 删除需输入名称确认；成功后回读集合

## 失败排查

- 创建后 rules 为空：确认服务端聚合需要 aggregation-roles 注解，不要手写 rules
- 模板角色出现写入口：确认按 creator=system 或 role-template-* 前缀隐藏
- 编辑权限后规则数不变：确认 PATCH 的注解值为 JSON 字符串数组

## 产品改版后如何更新自动化

- 句柄：workspace-roles:create/name/alias/description/submit/dialog/templates/template:<name>/error
