# 第三方登录（状态）（L3）

[子模块需求](../../../prd/kube-frontend/platform-settings/third-login.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01

## 概述

平台设置 › 第三方登录状态页。读 identityproviders（两种拼写），按可用性显示身份源卡片、未配置说明或接口不可用说明；只读。

## 设计目标与非目标

目标：状态可见、区分「没有配置」与「接口不存在」、不伪造写入口。非目标：凭据编辑、登录页按钮、LDAP 连接测试。

## 关键约束

- 老页面无写请求：Configure 弹窗 onOk 只关闭（源码事实），因此重纳范围是状态视图。
- 候选接口按顺序：/kapis/iam…/identityproviders、/apis/iam…/identityproviders。
- 404/400/501/5xx → available:false；403/网络错误 → throw。
- 页面位于 platform-settings 区域，路径 /settings/third-login。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01 — 接口不存在是独立状态，不显示空列表

**为什么**：identityproviders 在部分部署不存在（B200 实测两种拼写均 404）。显示空列表会被读成「平台没有配置身份源」，与「平台没有提供这个接口」是两件事；后者应引导管理员去安装配置而不是去添加身份源。

**被否方案**：统一 catch 返回空数组。会掩盖权限错误（403）并给出错误结论。

**何时重新考虑**：平台提供显式 capability/version 字段时。

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-02 — 只迁状态，不迁 Configure 假表单

**为什么**：老页面两个「配置」弹窗的 onOk 只关闭，没有请求。把表单照搬过来，用户填完凭据点击保存会毫无效果——比没有按钮更糟（迁移指南 §2.3）。凭据编辑需要独立的安全与 PATCH 语义设计，不在本批。

**被否方案**：按普通注解 PATCH 写 clientSecret。凭据会落进 annotations，且老实现根本没有这条写路径。

**何时重新考虑**：平台提供受支持的 identityprovider 写接口与凭据字段规范时。

## 系统现状

老 console settings/containers/ThirdPartyLogin：两张卡片（Github OAuth / OAuth）固定显示「未配置」+ Configure 按钮；弹窗仅收集字段、OK 关闭，无请求。新 UI 此前无 third-login 页面。N-02 重纳时把范围修正为状态视图。

## 仓库落点

- apps/console-next/src/pages/platform/ThirdLoginPage.tsx
- apps/console-next/src/routes/kube-frontend.settings/third-login/{route,index}.tsx
- apps/console-next/src/areas/registry.ts（platform-settings › third-login）
- packages/api-client/src/identity.ts（identityProvidersApi）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 身份源列表 | GET /kapis/iam.kubesphere.io/v1alpha2/identityproviders?limit=-1（回退 /apis/…） | items[].metadata.name、spec.type、spec.displayName |
| 不可用判定 | 上述两者均 404，或 400/501/5xx | reason 取最后一次响应；403 抛出 |

## 不变量

1. 可用且 N>0：卡片集合 = items 集合。
2. 可用且 N=0：显示「尚未配置」，不显示不可用。
3. 两接口均 404/5xx：显示不可用 + 原因，无 providers 列表。
4. 403 走错误面板，不显示不可用。
5. 页面无提交/保存/编辑控件的写入口。

## 已知坑

- B200 两种拼写均 404；不要按 mlu370 的预期写死可用。
- 403 与 404 必须分开；把 403 当「未配置」会让人去改身份源而不是修权限。
- spec 字段可能缺省；显示名回退对象名，类型缺省显示 -。
- 老页面 Configure 无写请求；迁移前先查 action 链（指南 §8 #36）。

## 测试与可观测

E2E：TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01（B200 不可用分支；接口可用时自动切到卡片/空态断言）。单测：packages/api-client/test/identity-providers.test.ts（映射/回退/403）。
可观测点：third-login:surface/unavailable/empty/providers/provider:<name>/retry/hint。

## 后续改进

受支持的身份源写接口；LDAP 连接测试；登录页第三方按钮与身份源联动。

## 验收用例

- TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01
