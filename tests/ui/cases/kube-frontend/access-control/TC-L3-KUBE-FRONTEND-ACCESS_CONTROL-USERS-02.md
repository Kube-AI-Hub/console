# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02 用户 · 创建、密码校验与密码强度面板

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

平台用户可由「创建」表单建立；密码框边输入边显示强度面板；弱密码与非法的用户名被拦下；创建后平台角色与 uninitialized=true 写在注解上。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02** — 已知在用户页，当点「创建」填写用户名、邮箱、密码、平台角色与可选描述并确认，则用户被创建且 `iam.kubesphere.io/platform-role` 等于所选角色、`iam.kubesphere.io/uninitialized` 为 `true`；填写了描述时 `kubesphere.io/description` 等于所填文本；用户名非法或密码弱于规则时提交被拦下并给出提示；密码输入过程中，字段下方显示强度面板（四条检查项与弱/中/强三档），随输入实时变化。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 创建一个能首次登录的平台账号 (Priority: P1)

作为 **平台管理员**，我希望 **填写用户名、邮箱、初始密码、平台角色和可选描述后创建账号**，以便 **对方第一次登录时被要求改密，而不是一直使用我设的初始密码**。

**Independent Test**：创建临时用户后回读 `iam.kubesphere.io/uninitialized=true` 与所选平台角色；弱密码或非法用户名不发请求。

## 前置与配置

- 已登录，且有平台权限
- 用例自行创建的用户在结束时无条件删除

## 测试步骤

1. 打开用户页并点「创建」
2. 密码框为空时看强度面板是否存在
3. 密码依次输入 abc、Abcdefg1@、Abcdefgh1234@，每一步读面板的 data-strength
4. 检查弹窗里有没有 user-settings:* 句柄
5. 填写非法用户名，点确认
6. 改为合法用户名、邮箱与弱密码，点确认
7. 改为强密码并选择平台角色，点确认
8. 用 IAM 接口读取该用户

## 期望结果

- 密码为空时弹窗里没有 users:password-strength 节点，输入框仍是
- abc 时 data-strength=weak；Abcdefg1@ 时 medium；Abcdefgh1234@ 时 strong
- 弹窗里没有 user-settings:* 前缀的句柄（两处面板 scope 不同）
- 非法用户名时提交被拦下
- 弱密码时提交被拦下并说明原因
- 提交后用户存在，iam.kubesphere.io/platform-role 等于所选角色，iam.kubesphere.io/uninitialized 为 true

## 失败排查

- 创建失败时确认写的是 iam.kubesphere.io 而不是核心组
- 角色为空说明注解没写到 metadata.annotations

## 产品改版后如何更新自动化

- 密码规则变化时改 api-client 的 passwordProblem
- 强度面板句柄变化时改用例里的 users:password-strength
