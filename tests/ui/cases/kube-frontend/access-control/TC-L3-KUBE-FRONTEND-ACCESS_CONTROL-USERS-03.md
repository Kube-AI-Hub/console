# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03 用户 · 修改平台角色与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

用户行操作提供「修改平台角色」与「删除」；改角色写注解，删除后该用户不再出现在列表里。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03** — 已知用户列表有数据，当行操作「修改平台角色」并选择平台管理员，则 `iam.kubesphere.io/platform-role` 变为 `platform-admin`；当「删除」并确认，则该用户不再出现在列表结果中。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清谁在平台上、是什么角色 (Priority: P1)

作为 **平台管理员**，我希望 **在列表上看到状态与平台角色**，以便 **确认访问范围**。

**Independent Test**：打开用户页，核对四列与某个用户的平台角色注解一致。

## 前置与配置

- 由夹具通过 IAM 接口创建一个 tc-e2e- 用户，用例结束无条件删除
- 已登录，且有平台权限

## 测试步骤

1. 打开用户页并定位该用户
2. 行操作点「修改平台角色」，选择平台管理员并确认
3. 用 IAM 接口读取该用户
4. 行操作点「删除」，输入用户名并确认
5. 用列表接口确认该用户已不存在

## 期望结果

- 行操作包含「修改平台角色」与「删除」
- iam.kubesphere.io/platform-role 变为 platform-admin
- 删除后该用户不在列表结果中

## 失败排查

- 改角色返回 405 说明用了 PATCH；IAM 的 users 端点只接受 PUT
- 删除后 GET 返回 500 是该端点的固有行为，应按「不存在」处理

## 产品改版后如何更新自动化

- 角色清单变化时改 api-client 的 ASSIGNABLE_PLATFORM_ROLES
