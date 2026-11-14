# 飞书渠道（L3）

[子模块需求](../../../prd/kube-frontend/platform-settings/feishu.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01

## 概述

飞书渠道页复用渠道声明表与通用页面（`channelDescriptors.ts` + `ChannelConfigPage.tsx`）。本文件只记录它与其他渠道不同的三点：一条渠道里有三种接入方式、Config/Receiver 要写四份 `secretKeyRef`、群机器人方式没有 Config。

## 设计目标与非目标

目标：加一条声明就把飞书页做出来，页面、保存与校验逻辑不复制。非目标：飞书应用/机器人的创建、通知条件与模板、凭据回读。

## 关键约束

- 对象名：Config `default-feishu-config`、Receiver `global-feishu-receiver`、Secret `global-feishu-config-secret`（老 console 同名）。
- Config 的 `spec.feishu` 在 CRD 里 **appID 与 appSecret 都是 required**：只要写 `spec.feishu`，就必须同时写两个 `secretKeyRef`。
- Receiver 的 `spec.feishu.chatbot.webhook` 是 required；`secret` 与 `keywords` 可选。
- 凭据只写 Secret；Config/Receiver 只带引用，页面不回读 Secret。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01 — 三种接入方式用一次下拉表达，扩展点只有 `visibleWhen` 与 `secretRefs`

**为什么**：老 console 的飞书表单是「会话设置 / 机器人设置」两个外层 tab，会话里再嵌「User ID / Department ID」两个 tab。落到声明表里只需要一个三值下拉（user / department / chatbot），字段用 `visibleWhen` 控制显隐；三种方式的差别全部是数据。

**为什么扩两处表结构**：
1. `visibleWhen.equals` 原来只接受单个字符串，而应用凭据要同时出现在 user 与 department 两种方式里，改成 `string | string[]`；
2. 原来只有一个 `secretRef`（且只能写进 Config），飞书要写两个 Config 引用和两个 Receiver 引用，于是增加 `secretRefs` 列表（带 `target` 与 `visibleWhen`）。

**被否方案**：给飞书写独立页面/表单组件。会让「渠道差异是一张表」这个约定破掉，五渠道的通用页与飞书页随后会各自漂移。

**被否方案**：把三种方式拆成两个下拉（会话/机器人 + 用户/部门）。声明表只推断第一个下拉，第二个下拉的已保存值无法从 Receiver 推断，打开页面会永远停在默认的「用户 ID」并可能在下一次保存时写错键。

**何时重新考虑**：出现需要分步向导或字段间联动的渠道时，声明表不再是合适抽象。

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-02 — 群机器人方式不写空 Config

**为什么**：群机器人把 webhook 与签名密钥都在 Receiver 的引用里，Config 无事可做。老 console 在 `spec.feishu` 为空时删除 Config；新页面沿用这个结果：`toBodies` 产出空 Config spec 时，保存阶段删除已存在的 Config 而不是写一个平台用不上的空对象；「发送测试」也不再带 config 字段。

**被否方案**：始终创建空 Config。平台 CRD 允许空 spec，但会在「已配置」徽标上谎报一个实际不存在的传输配置，并留下一个永远无人读取的对象。

**代价**：飞书是这个通用页面里唯一可能删除对象（而不是只写对象）的渠道；页面里因此多一个分支，且「已配置」判定改为「Config 或 Receiver 存在」（`readChannel`）。

## 系统现状

老 console：`src/pages/settings/containers/Notification/FeiShu/index.jsx` + `components/Forms/Notification/FeiShuForm/index.jsx`。保存时把 App ID/App Secret 写进 Secret，Config 里写 `spec.feishu.appID/appSecret` 的 `secretKeyRef`；Receiver 里写 `spec.feishu.chatbot.webhook/secret` 的 `secretKeyRef` 以及 `chatbot.keywords`、`user`、`department`；应用凭据为空时删除 Config。

新 UI：`/kube-frontend/settings/feishu` 复用通用渠道页，用「接入方式」下拉切换字段组；保存顺序与其它渠道相同（Config → Secret → Receiver）。

## 仓库落点

- `apps/console-next/src/pages/platform/channelDescriptors.ts`：飞书描述（对象名、字段、`secretRefs`、`inferMode`），以及 `visibleWhen` 数组与 `secretRefs` 两个扩展点
- `apps/console-next/src/pages/platform/ChannelConfigPage.tsx`：空 Config 的删除与「发送测试」不带 config
- `apps/console-next/src/routes/kube-frontend.settings/feishu/{route,index}.tsx`
- `packages/api-client/src/notification.ts`：`NOTIFICATION_CHANNELS` / `CHANNEL_SPEC_KEY` 加 feishu；`readChannel` 的 `configured` 改为「Config 或 Receiver 存在」
- `packages/locales/src/index.ts`：飞书渠道的字段文案（zh/en）
- 区域菜单：`src/areas/registry.ts` 的 `feishu` 条目（Lead 预置，本任务未改）

## 对外契约

| 对象 | 名称 | 飞书写入的字段 |
| --- | --- | --- |
| Config | `default-feishu-config` | `spec.feishu.appID.valueFrom.secretKeyRef{name=global-feishu-config-secret,key=appkey}`、`spec.feishu.appSecret…{key=appsecret}`（仅应用方式） |
| Receiver | `global-feishu-receiver` | `spec.feishu.enabled`；应用方式写 `user` 或 `department`；群机器人写 `chatbot.keywords`、`chatbot.webhook…{key=webhook}`、`chatbot.secret…{key=chatbotsecret}` |
| Secret | `global-feishu-config-secret` | `data.appkey` / `data.appsecret`（应用方式）、`data.webhook` / `data.chatbotsecret`（群机器人方式），值为 base64 |

## 不变量

1. 只写当前接入方式的字段组；切换方式不发送另一组。
2. 凭据只进 Secret；Config 与 Receiver 只带 `secretKeyRef`。
3. `spec.feishu` 一旦写入 Config，appID 与 appSecret 两个引用必须同时存在。
4. 群机器人方式不留下 Config。
5. 页面不回读 Secret。

## 已知坑

- **平台校验 webhook 不可用时保存必 400**：B200 实测（2026-11-14）`vconfig.notification.kubesphere.io` 与 `vreceiver.notification.kubesphere.io` 均返回 `context deadline exceeded`，所有渠道的保存都失败；这是环境问题，E2E 用例据此跳过并写明原因。
- **不要照抄老 console 的嵌套 tab name**：`FeiShuForm` 里「Department ID」那个 TabPanel 的 `name` 写的是 `chatbot`（复制粘贴遗留）。判断接入方式要看 Receiver 里实际存在哪个键（`chatbot` / `department` / `user`）。
- **Config CRD 的 required**：`spec.feishu.appID` 与 `appSecret` 都是 required，只写一个会被 webhook 拒绝。
- **切换方式会丢另一方式的凭据**：Secret 是整体替换，页面又不回读旧值；与老 console 行为一致，暂不修。
- **App ID 每次保存都要重填**：Secret 不回读，App ID 字段是 text 且必填（与钉钉的 App Key 相同）。App Secret 是密码字段，留空表示沿用。
- **新增路由要重建**：路由由 TanStack 文件路由插件扫描生成 `routeTree.gen.ts`，加 `feishu/` 目录后必须跑一次 `vite build`（或 dev），否则地址 404。

## 测试与可观测

- 单测：`apps/console-next/test/channel-descriptors.test.ts` 的 feishu 组（6 条：对象名、应用/部门/机器人三种写入、方式推断、校验）；`packages/api-client/test/notification.test.ts` 覆盖渠道列表与 spec key。
- E2E：`tests/ui/specs/kube-frontend/platform-settings/TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01.yaml`。
- 可观测点：`notification-feishu:surface`（`data-ai-state`）、`:enabled`、`:save`、`:save-error`、`:verify-result`；字段输入框 id 为 `#ai-field-feishu-<key>`（mode / appkey / appsecret / users / departments / webhook / chatbotsecret / keywords），外层 `data-ai-id="notification-feishu:<key>"`。

## 后续改进

- 通知条件（`alertSelector`）与消息模板（`template/tmplText/tmplType`）。
- 平台提供脱敏的渠道状态接口后再回显已保存的 App ID。
- 节点 shell / kubectl 等其它通知入口与飞书无关，不在此列。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01`
