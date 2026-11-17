# 平台设置（L2）

[子模块需求](../../../prd/kube-frontend/platform-settings/_index.md)

## 关联需求

- AC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01

## 概述

平台信息与通知渠道两个只读页面；第三方登录配置页（重纳 N-02）与账单页（重纳 N-03）尚未实现，登记见 `DEC-L2-KUBE-FRONTEND-PLATFORM_SETTINGS-03` 与 `DEC-CORE-KUBE-FRONTEND-10`。

## 设计目标与非目标

目标：平台信息与渠道凭据只读、无副作用、未配置显式。非目标：平台信息与渠道凭据的任何写入。第三方登录配置是这条之外的唯一写入点，见 `DEC-L2-KUBE-FRONTEND-PLATFORM_SETTINGS-03`。

## 关键约束

- 平台配置读核心组 ConfigMap；渠道只看 Secret 是否存在。

## 方案决策

### DEC-L2-KUBE-FRONTEND-PLATFORM_SETTINGS-01 — 用缩进扫描读 YAML，而不是引入 YAML 解析器

**为什么**：只需要 `console:` 段下的三个标量。为三个字符串引入解析器，会把它带进首屏 bundle；缩进扫描的规则简单到可以逐行审阅。

**被否方案**：`js-yaml` 解析全文件。首屏成本与收益不成比例。

**何时重新考虑**：需要读取嵌套较深或数量可变的配置项时。

### DEC-L2-KUBE-FRONTEND-PLATFORM_SETTINGS-02 — 渠道只报「是否配置」，不读凭据

**为什么**：渠道凭据是 Secret，读出来对页面没有用处（页面也不显示），却扩大了敏感数据的暴露面。存在性足以回答「告警为什么发不出去」。

**被否方案**：读取 Secret 并显示渠道的部分配置（如 SMTP 主机）。收益是排查更细，代价是把凭据带进前端内存与网络传输。

**何时重新考虑**：平台提供脱敏的渠道状态接口时。

### DEC-L2-KUBE-FRONTEND-PLATFORM_SETTINGS-03 — 第三方登录重纳：先探测接口，再定页面形态

**新决定（2026-11-17 产品复核决定重纳）**：第三方登录（OAuth / GitHub OAuth / LDAP）重新纳入迁移范围，作为平台设置区域的一个页面（`/kube-frontend/settings/third-login`），与通知渠道并列；登录页不放第三方登录按钮（职责边界见 `DEC-L2-KUBE-FRONTEND-LOGIN-05`）。

**原判断（2026-11-14，现被推翻）**：本模块「明确不做」第 2 条写着「第三方登录配置（依赖外部身份提供方）」。推翻它的理由有两条：①「依赖外部身份提供方」是**前置条件**，不是**不该做**——部署没有身份源时应该显示「未配置身份源」，而不是让这项能力从范围里消失；②历史结论「`identityproviders` 404」**没有记录探测的版本与角色**，按[迁移指南](../../legacy-ui-migration-guide.md) §2.3，只试一个版本得到的 404 证明的是那个版本没有，不是没有。

**被否方案**：继续保持不做，理由是「部署无可配置身份源」。否掉的原因同 ①：这是环境事实，会随部署变化，写成永久不做会让将来接入身份源的部署无从下手。

**被否方案**：把第三方登录做成登录页的一部分（登录页读 `oauthServers` 决定显示哪些按钮）。否掉的原因：登录页是未鉴权页面，读平台配置会把「配置读失败」放大成「登录页不可用」，而且配置能力在登录页上无处安放。

**落地约定**：
1. **先探测再定形态**，顺序固定为「①老源码里它调哪个 API（老 `settings/containers/ThirdPartyLogin` 与 `components/Modals/{OAuth,GithubOAuth}`）→②该组该版本是否被服务（`/apis` 的 resources 清单）→③实际读一次」。探测结论要连同**版本与角色**一起记录，不允许只写「404」。
2. **读不到与没配置是两件事**（迁移指南 §8 坑 15）：接口不可用时显示「身份源配置不可读」并给出原因，配置为空时显示「未配置身份源」，两者都不渲染空表。
3. **凭据只写不读**：沿用本模块已有的做法（`DEC-...-02`），表单里密码类字段留空表示「保持原值」，不在页面上回显任何密钥。

**待补**：本页的 `US`/`AC`/`TC` 与功能点文件 `third-login.md` 尚未创建；在探测结论落地前不写验收断言。

## 系统现状

老 console 平台设置有平台信息页与五种渠道的独立配置页（可编辑）。本模块只做只读呈现。

## 仓库落点

- `apps/console-next/src/pages/platform/PlatformInfoPage.tsx`（平台信息）与 `ChannelConfigPage.tsx`（五种通知渠道）
- `packages/api-client/src/access.ts` 的 `configScalar` / `toPlatformInfo` / `toNotificationChannels`
- `src/routes/kube-frontend.settings/`

## 对外契约

读 `/api/v1/namespaces/kubesphere-system/configmaps/kubesphere-config` 与 `/api/v1/namespaces/kubesphere-monitoring-system/secrets`。

## 不变量

1. 不读取 Secret 内容。
2. 配置缺失时显示 `-`，不显示错误。

## 已知坑

- 目标集群的 `kubesphere.yaml` 里**没有 `console` 段**，三行会显示 `-`。这是配置现状，不是页面缺陷；用例据此断言。
- resources 代理对该 ConfigMap 返回 500，必须走核心组。

## 测试与可观测

E2E：`tests/kube-frontend/platform-settings/`。

## 后续改进

渠道编辑（需要平台侧表单与凭据写入）。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01`

## 页面与技术结构

- 区域 `platform-settings`（两页），布局 `kube-frontend.settings/route.tsx`。
- 组件 `PlatformInfoPage`（平台信息）与 `ChannelConfigPage`（按 `channel` 渲染一个通知渠道）；两者共用 `DefinitionRow` 的只读呈现。

## 状态与数据归属

- 两页各用自己的 Query key；渠道列表不缓存凭据（从不读取）。

## 关键契约与依赖

- `platformInfoApi`、`toNotificationChannels`。

## 明确不做

- 编辑平台信息与通知渠道。

## 功能点

| 功能点 | 需求 | 技术方案 |
|---|---|---|
| 平台信息 | `prd/…/info.md` | `design/…/info.md` |
| 通知渠道 | `prd/…/notifications.md` | `design/…/notifications.md` |
