# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01 服务账户 · 修改角色

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `role`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/role.md`

## 产品功能

修改角色发出单字段 merge patch，其余字段不变。

### 关联需求

- `prd/kube-frontend/serviceaccounts/role.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/role.md`](../../../../prd/kube-frontend/serviceaccounts/role.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-ROLE-01** — Given 一条带角色的服务账户，When 打开「修改角色」，Then 选择器预选当前角色且选项来自该项目的角色列表；When 选择另一个角色并确认，Then 请求为 `PATCH` 且 `content-type: application/merge-patch+json`，`metadata.annotations['iam.kubesphere.io/role']` 更新为新值，`secrets[]` 等其他字段不变。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/role.md`](../../../../design/kube-frontend/serviceaccounts/role.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/role.md`](../../../../prd/kube-frontend/serviceaccounts/role.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，把账户从 viewer 提升为 editor


**Independent Test**：行操作「修改角色」→ 选择 `project-editor` → 确认；列表与详情的角色变为 `project-editor`，其他注解不变。

### US2 - 作为项目成员，清空角色


**Independent Test**：选择「不设置」→ 确认；注解变为空字符串，列表角色列变空。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 测试账户带一个角色，项目里至少有另一个角色

## 测试步骤

1. 行操作「修改角色」
2. 选择另一个角色并确认
3. 读取请求方法与 content-type
4. 读取对象

## 期望结果

- 选择器预选当前角色
- 请求为 PATCH 且 content-type 为 application/merge-patch+json
- 注解更新为新角色
- secrets[] 等其他字段不变

## 失败排查

- 出现 PUT 说明走了整对象替换路径

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
