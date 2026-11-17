# 第三方登录（状态）（L3）

[子模块需求](./_index.md)

## 概述

平台设置 › 第三方登录：/kube-frontend/settings/third-login。展示平台当前配置的身份源（OAuth / GitHub / LDAP / OIDC），接口未提供时明确说明「本部署未提供身份源读取接口」。只读。

来源：2026-11-17 产品复核重纳 N-02。**重要事实**：老 console 的 ThirdPartyLogin 页面两个「配置」按钮打开的弹窗，其 onOk 只关闭弹窗、不发任何请求（源码 settings/containers/ThirdPartyLogin/index.jsx + settings/components/Modals/{OAuth,GithubOAuth}）；因此本页没有可迁移的写能力，重纳范围是「状态可见 + 配置说明」，不是凭据编辑。

## 用户故事

### US1 - 确认平台是否启用第三方登录 (Priority: P2)

作为 **平台管理员**，我希望 **在平台设置里看到当前配置的身份源（或明确知道该部署没有提供身份源接口）**，以便 **判断登录页为什么有/没有第三方登录入口，而不用去翻安装配置**。

**Independent Test**：打开 /settings/third-login；若 identityproviders 接口可用，则卡片集合与接口 items 一致（空则显示「尚未配置」）；若接口 404/5xx，则显示「本部署未提供身份源读取接口」+ 原因 + 重试，且没有空列表。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01** — 已知已登录平台管理员，当打开第三方登录页：接口可用且返回 N 个身份源（N 可能为 0），则 N>0 时按身份源显示卡片（显示名/对象名/类型/已配置徽标），N=0 时显示「尚未配置第三方登录」说明；接口 404/400/501/5xx 时显示「本部署未提供身份源读取接口」+ 上游原因 + 重试，绝不显示空列表；403 仍显示错误面板与重试。页面只读，不提供凭据编辑/保存入口。

## 设计目标

- 把「没有配置身份源」与「这个部署不提供身份源接口」分开。
- 不把老页面从不提交的表单照搬成假写入口。

## 约束与边界

- 候选接口：/kapis/iam.kubesphere.io/v1alpha2/identityproviders 与 /apis/… 两种拼写，按顺序尝试；首个非 404 应答生效。
- 403/网络错误是错误，不是「未配置」；404/400/501/5xx 才是不可用。
- 只读：凭据编辑需要独立设计（不能按普通注解 PATCH），本批不做。
- 平台设置区域注册 third-login；入口与通知渠道并列。

## UI 交互设计

- 头部：标题「第三方登录」+ 描述。
- 可用：身份源卡片列表（显示名、对象名、类型、已配置徽标）；空：说明。
- 不可用：说明 + 原因（等宽小字）+ 重试。
- 底部固定说明：本页为状态视图，老页面 Configure 弹窗只关闭不提交，凭据不由本页编辑。
- data-ai-id：third-login:surface/unavailable/empty/providers/provider:<name>/retry/hint。

## 文案与校验

- 不可用标题「本部署未提供身份源读取接口」；描述说明接口缺失而非空列表。
- 空态标题「尚未配置第三方登录」；描述引导在平台身份配置中启用 OAuth/LDAP/OIDC。
- 类型缺失显示 -；显示名缺失回退对象名。

## 边界情况

- 两种接口拼写都 404 → 不可用（原因取最后一次）。
- 200 但 items 为空 → 尚未配置（与不可用区分）。
- 403 → 错误面板，不显示「未提供」。
- 身份源对象 spec 缺字段 → 名称/类型回退 -，不隐藏卡片。

## 明确不做

- 凭据编辑/保存（老页面无写请求；新写接口需要独立凭据语义与安全评审）。
- 登录页的第三方按钮（登录页已按 oauthServers 布局，不在本页范围）。
- LDAP 连接测试、身份源启停。

## 假设

- 若部署提供 identityproviders，返回 items[].metadata.name 与 spec.type/displayName；不同版本字段可能缺省，页面可降级显示。

## 功能需求

- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01** — 平台设置提供第三方登录状态页，按接口可用性区分已配置/未配置/接口不可用。
- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-02** — 页面只读，不渲染凭据编辑入口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01** — 卡片集合 = 接口 items 集合；404/5xx 时显示不可用且无 providers 列表；403 显示错误面板。

## 验收用例

- TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01
