# 邮件通知渠道（L3）

[子模块需求](../../../prd/kube-frontend/platform-settings/mail.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01
- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-02
- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-03

## 概述

邮件渠道的读写页面，替换原来只读的「通知渠道」概览。

## 系统现状

- 老 console：`settings/containers/Notification/Mail`，读写 `default-email-config`（Config）、`global-email-receiver`（Receiver）、`global-email-config-secret`（Secret），字段见 `components/Forms/Notification/MailForm`，密码 `safeBtoa`，保存顺序 config → secret → receiver。
- 新 UI 原来只列「哪个渠道有 Secret」，且按 `kubesphere-monitoring-system` 里的 `<channel>s` Secret 判断——**模型与平台不符**（该命名空间没有这些 Secret）。
- 本环境通知模块已安装：v2beta2 提供 `configs/receivers/verification`，v2beta1 提供 `secrets`。

## 仓库落点

- `packages/api-client/src/notification.ts`
- `apps/console-next/src/pages/platform/MailChannelPage.tsx`
- `routes/kube-frontend.settings/mail/{route,index}.tsx`；`settings/notifications` 改为重定向

## 对外契约

| 动作 | 请求 |
| --- | --- |
| 读 | `GET /kapis/notification.kubesphere.io/v2beta2/{configs,receivers}/<name>`、`GET /kapis/notification.kubesphere.io/v2beta1/secrets/<name>` |
| 建 | `POST .../v2beta2/configs`（**集合**端点） |
| 改 | `PUT .../v2beta2/configs/<name>`（带刚读到的 `resourceVersion`） |
| 测试 | `POST .../v2beta2/verification` |

## 设计目标与非目标

目标：填、存、试三件事在一个页面完成且失败可行动。非目标：其余四个渠道（下一轮）。

## 关键约束

- 密码只写不读；留空沿用。Secret 的 `data` 是 base64。
- 创建与更新的路径不同（集合 vs 对象），后者还要求 `resourceVersion`。
- 验证结果看响应体 `Status`，不看 HTTP 状态。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01 — 一个渠道一页，不再有"渠道概览"

**为什么**：老 console 就是每渠道一页；"是否配置"在渠道自己的页上就有徽标，概览页重复且无法操作。`/settings/notifications` 保留为重定向，避免旧链接 404。

**被否方案**：保留概览 + 点击进入。多一次点击，且概览的数据源只能是三个对象的组合。

**何时重新考虑**：渠道数量增长到需要横向比较时。

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-02 — 保存三步按 config → secret → receiver

**为什么**：Config 是 Receiver 有意义的前提；先写 Config 再写指向它的 Secret 与 Receiver，失败时不会留下"有收件人但没有传输配置"的半套。

**被否方案**：并发写三个对象。失败时无法判断哪一步需要重试。

**何时重新考虑**：平台提供事务性保存接口。

## 不变量

1. `config.spec.email.authPassword.valueFrom.secretKeyRef` 始终指向 `global-email-config-secret`。
2. 密码字段为空时不覆盖已保存的 Secret。
3. 校验失败不发请求。

## 已知坑

- **创建要 POST 到集合端点**：POST 到对象路径返回 405。
- **验证的判据在响应体**：HTTP 200 + `Status: 400` 是失败。
- **本环境曾出现校验 webhook 超时**：`vconfig.notification.kubesphere.io` 调用 `notification-manager-webhook:443` 超时会让创建返回 400，页面必须把这段原因显示出来（本轮实测遇到）。

## 测试与可观测

- 单测：对象路径与请求体、base64、`resourceVersion`、验证归一。
- E2E：字段校验拦截（无需写入）；保存与回显在平台 webhook 可用时验证，不可用时以明确原因跳过。

## 后续改进

- 钉钉/企业微信/Slack/Webhook 四个渠道。
- 收件人按项目/用户组过滤。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-MAIL-01`
