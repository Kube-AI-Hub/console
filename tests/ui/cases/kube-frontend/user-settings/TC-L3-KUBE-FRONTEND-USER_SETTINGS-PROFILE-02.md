# TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02 基本信息 · 邮箱非法时本地拒绝，合法时整对象 PUT 且注解不变

- **用例 ID**: `TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `user-settings` `profile`
- **入口**: `{BASE_URL}/kube-frontend`
- **需求**: `prd/kube-frontend/user-settings/profile.md`

## 产品功能

['基本信息页签保存邮箱：空值或格式非法时被本地校验挡下、不发写请求；合法时整对象 PUT 成功，回读 spec.email 为新值，平台角色与描述注解保持不变。']

### 关联需求

- `prd/kube-frontend/user-settings/profile.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/user-settings/profile.md`](../../../../prd/kube-frontend/user-settings/profile.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02** — 已知在基本信息页签，当邮箱为空或格式非法时点保存，则保存被拒绝并给出提示，且不发出写请求；当邮箱合法时保存，则整对象 PUT 成功，回读 `spec.email` 为新值，且 `iam.kubesphere.io/platform-role` 与 `kubesphere.io/description` 两个注解保持不变。

### 关联设计

- 技术方案 [`design/kube-frontend/user-settings/profile.md`](../../../../design/kube-frontend/user-settings/profile.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/user-settings/profile.md`](../../../../prd/kube-frontend/user-settings/profile.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 改自己的邮箱，不需要平台管理权限 (Priority: P1)

作为 **登录用户**，我希望 **在用户设置里改自己的邮箱并保存**，以便 **换邮箱后不必找管理员，也不必等审批**。

**Independent Test**：用 platform-regular 账号打开用户设置，把邮箱改成 `new-<时间戳>@example.com` 并保存；重新打开弹窗，核对输入框与 `GET users/<name>` 的 `spec.email` 都是新值；再用 kubectl 核对 `iam.kubesphere.io/platform-role` 注解仍在。

## 前置与配置

- 用管理员令牌通过 kapis 新建临时账号 tc-e2e-uset-<uuid>（platform-regular，带 kubesphere.io/description），用例结束在 finally 里删除
- 在独立 browser context 里用登录页真登录该临时账号（弹窗只能改当前登录账号）

## 测试步骤

1. 以临时账号登录，从账号菜单打开「用户设置」，确认邮箱初值等于接口值
2. 清空邮箱后点保存
3. 填入 not-an-email 后点保存
4. 填入合法邮箱后点保存
5. 回读账号对象，核对 spec.email 与两个注解
6. 统计每一步发出的写请求

## 期望结果

- 空邮箱与非法邮箱都显示 user-settings:profile-error「请输入合法的邮箱地址。」
- 这两步没有任何写请求
- 合法邮箱显示 user-settings:profile-saved「已保存。」，且恰好发出一次 PUT users/<name>
- 回读 spec.email 等于新邮箱
- iam.kubesphere.io/platform-role 仍为 platform-regular，kubesphere.io/description 保持原值

## 失败排查

- 保存后注解丢了：说明写路径用了 PATCH 或者构造 PUT 体时漏了 annotations
- 非法邮箱仍有写请求：前端校验被绕过，直接打到了 admission webhook

## 产品改版后如何更新自动化

- 文案变化时改 pages/user_settings.py 与用例里的常量
