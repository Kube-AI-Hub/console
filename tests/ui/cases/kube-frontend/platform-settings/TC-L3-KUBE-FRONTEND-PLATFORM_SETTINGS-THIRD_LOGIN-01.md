# TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01 第三方登录状态页（身份源可读 / 不可读两态）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `platform-settings` `third-login`
- **入口**: `{BASE_URL}/kube-frontend/settings/third-login`
- **需求**: `prd/kube-frontend/platform-settings/third-login.md`

## 产品功能

平台设置「第三方登录」状态页：接口可用时按身份源显示卡片（名称/类型）；接口未提供时明确说明「本部署未提供身份源读取接口」，不显示空列表；页面只读，不提供凭据编辑。

### 关联需求

- `prd/kube-frontend/platform-settings/third-login.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/third-login.md`](../../../../prd/kube-frontend/platform-settings/third-login.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01** — 已知已登录平台管理员，当打开第三方登录页：接口可用且返回 N 个身份源（N 可能为 0），则 N>0 时按身份源显示卡片（显示名/对象名/类型/已配置徽标），N=0 时显示「尚未配置第三方登录」说明；接口 404/400/501/5xx 时显示「本部署未提供身份源读取接口」+ 上游原因 + 重试，绝不显示空列表；403 仍显示错误面板与重试。页面只读，不提供凭据编辑/保存入口。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/third-login.md`](../../../../design/kube-frontend/platform-settings/third-login.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/third-login.md`](../../../../prd/kube-frontend/platform-settings/third-login.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认平台是否启用第三方登录 (Priority: P2)

作为 **平台管理员**，我希望 **在平台设置里看到当前配置的身份源（或明确知道该部署没有提供身份源接口）**，以便 **判断登录页为什么有/没有第三方登录入口，而不用去翻安装配置**。

**Independent Test**：打开 /settings/third-login；若 identityproviders 接口可用，则卡片集合与接口 items 一致（空则显示「尚未配置」）；若接口 404/5xx，则显示「本部署未提供身份源读取接口」+ 原因 + 重试，且没有空列表。

## 前置与配置

- 已登录 admin；B200 的 identityproviders 路由 404（页面应走不可读态）

## 测试步骤

1. 从平台设置进入「第三方登录」（或直接访问 URL）
2. 通过 API 探测 /kapis/iam…/identityproviders；按探测结果分支断言页面
3. 接口 404/不可读：断言显示 unavailable 说明与原因，且没有 providers 列表
4. 接口可用：断言行集合与接口一致（空则 empty 说明）

## 期望结果

- 页面状态由接口可用性决定，不用空列表表达“没有接口”
- 403 仍走错误面板（单测覆盖）
- 页面无写入按钮/表单（老页面的 Configure 弹窗只关闭，不提交）

## 失败排查

- 页面显示空列表：检查是否把 404 当成了 200 空集合
- 无法进入页面：确认 platform-settings 区域注册了 third-login

## 产品改版后如何更新自动化

- 句柄：third-login:surface/unavailable/empty/providers/provider:<name>/retry/hint
