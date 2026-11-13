# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02 用户 · 创建与密码校验

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

平台用户可由「创建」表单建立；弱密码与非法的用户名被拦下；创建后平台角色写在注解上。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02** — 已知在用户页，当点「创建」填写用户名、邮箱、密码与平台角色并确认，则用户被创建且 `iam.kubesphere.io/platform-role` 注解等于所选角色；用户名非法或密码弱于规则时提交被拦下并给出提示。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清谁在平台上、是什么角色 (Priority: P1)

作为 **平台管理员**，我希望 **在列表上看到状态与平台角色**，以便 **确认访问范围**。

**Independent Test**：打开用户页，核对四列与某个用户的平台角色注解一致。

## 前置与配置

- 已登录，且有平台权限
- 用例自行创建的用户在结束时无条件删除

## 测试步骤

1. 打开用户页并点「创建」
2. 填写非法用户名，点确认
3. 改为合法用户名、邮箱与弱密码，点确认
4. 改为强密码并选择平台角色，点确认
5. 用 IAM 接口读取该用户

## 期望结果

- 非法用户名时提交被拦下
- 弱密码时提交被拦下并说明原因
- 提交后用户存在，且 iam.kubesphere.io/platform-role 等于所选角色

## 失败排查

- 创建失败时确认写的是 iam.kubesphere.io 而不是核心组
- 角色为空说明注解没写到 metadata.annotations

## 产品改版后如何更新自动化

- 密码规则变化时改 api-client 的 passwordProblem
