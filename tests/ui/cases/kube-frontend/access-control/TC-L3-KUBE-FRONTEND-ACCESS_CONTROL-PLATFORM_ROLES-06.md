# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-06 平台角色编辑器支持多条规则

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `platform-roles`
- **入口**: `{BASE_URL}/kube-frontend/access/clusterroles`
- **需求**: `prd/kube-frontend/access-control/platform-roles.md`

## 产品功能

平台角色编辑器可添加/删除多条规则；编辑既有角色时带回现有规则，不会把权限替换成默认一条。

### 关联需求

- `prd/kube-frontend/access-control/platform-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-06** — 已知打开平台角色编辑器，当添加两条规则（第一条 `pods` + get/list，第二条 `apps` 组 + `deployments,statefulsets` + get/list/update）并提交，则该角色对象 `rules` 恰有 2 条、字段与填写一致；再次打开该角色的编辑，两条规则都以可编辑行回显（不是被替换成默认一条）；只保留一条规则提交时对象只剩 1 条。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/platform-roles.md`](../../../../design/kube-frontend/access-control/platform-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清平台上有哪些角色 (Priority: P1)

作为 **平台管理员**，我希望 **看到规则数与是否模板**，以便 **区分可分配与内置角色**。

**Independent Test**：打开平台角色页，核对列与某个角色行。

## 前置与配置

- 已登录且可写 clusterrole（RBAC 组，不含 KubeSphere validating webhook）

## 测试步骤

1. 打开平台角色页，点创建
2. 填写名称，第一条规则 pods + get/list
3. 添加第二条规则 apps/deployments,statefulsets + get/list/update
4. 提交并回读对象
5. 再次打开该角色编辑，观察规则行数

## 期望结果

- 回读 rules 长度 2，字段与填写一致
- 编辑弹窗回显两条规则行（role-editor:rule:0 / rule:1）

## 失败排查

- 回读只有 1 条：表单未把多行转成多规则
- 编辑弹窗只有 1 行：未读取既有规则（RBAC 是整对象替换，会静默降权）
- 创建 422：apiGroups 为空时核心组必须写成 [""]，由 api-client 负责

## 产品改版后如何更新自动化

- 选择器：role-editor:name / :rule-add / rule:<i>:groups|resources|verb:<verb> / :submit
