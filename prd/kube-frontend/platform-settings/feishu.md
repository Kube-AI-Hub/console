# 飞书渠道（L3）

[子模块需求](./_index.md)

## 概述

平台设置里的飞书通知渠道。它和邮件、钉钉等渠道一样由 Config / Receiver / Secret 三个对象组成，但一条渠道里支持三种投递方式：应用按用户 ID、应用按部门 ID、群机器人（Webhook + 签名密钥 + 关键词）。字段与对象结构对齐老 console 的 `FeiShuForm` 与平台 `notification.kubesphere.io/v2beta2` 的 CRD。

## 用户故事

### US1 - 用飞书接收平台通知 (Priority: P1)

作为 **平台管理员**，我希望 **把告警接到飞书（应用推送给用户或部门，或群机器人推给群）**，以便 **通知落在团队实际看的飞书会话里**。

**Independent Test**：打开飞书页，切换三种接入方式核对字段组；填写应用凭据与用户 ID 保存，接口读回 Config 的 `spec.feishu.appID/appSecret` 引用、Receiver 的 `spec.feishu.user` 与 Secret 的 `appkey/appsecret`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01** — 已知平台已安装通知模块，当打开 `/kube-frontend/settings/feishu`，则页面按接入方式渲染字段：用户 ID 方式显示 App ID、App Secret、用户 ID；部门 ID 方式显示 App ID、App Secret、部门 ID；群机器人方式显示 Webhook、签名密钥、关键词；未配置时徽标显示「未配置」，切换方式只显示当前方式的字段。必填为空时保存被拦下且不发请求。保存写入 `default-feishu-config` / `global-feishu-receiver` / `global-feishu-config-secret`：Config 带 appID/appSecret 的 secretKeyRef，Receiver 的 `spec.feishu` 带所选方式的键与 `enabled`，Secret 带对应凭据；群机器人方式不创建 Config。平台校验 webhook 不可用时保存返回 400 且页面显示服务端原因（此时自动化用例跳过并写明环境原因）。

## 设计目标

1. 复用渠道声明表：飞书只是多一条描述，页面、保存与校验不新增组件。
2. 三种接入方式一次只写一种，避免留下第二套半配置的传输。

## 约束与边界

- 对象名沿用老 console：`default-feishu-config`、`global-feishu-receiver`、`global-feishu-config-secret`。
- 应用凭据（App ID/App Secret）存在 Secret 的 `appkey/appsecret`，Config 只写 `valueFrom.secretKeyRef` 引用；群机器人的 webhook 与签名密钥同样在 Secret，Receiver 以引用读取。
- 群机器人方式没有 Config：保存时会删除已存在的空 Config（与老 console 相同）。
- 页面不回读 Secret；凭据留空表示沿用已保存的值，首次保存必须填写。
- 三种方式互斥：只写当前方式那一组字段。

## UI 交互设计

- 页头：渠道名 + 描述 + 「已配置 / 未配置」徽标；「启用该渠道」开关。
- 「接入方式」下拉：用户 ID（应用）/ 部门 ID（应用）/ 群机器人。选中后只显示该方式的字段组。
- 字段组：用户 ID 方式 = App ID、App Secret、用户 ID；部门 ID 方式 = App ID、App Secret、部门 ID；群机器人方式 = Webhook、签名密钥、关键词。
- 底部「保存」与「发送测试」；保存失败在按钮上方显示服务端原因。

## 文案与校验

- 接入方式：用户 ID（应用）/ 部门 ID（应用）/ 群机器人。
- App ID、App Secret、用户 ID、部门 ID、Webhook 地址、签名密钥、关键词。
- 提示：多个用户 ID / 部门 ID / 关键词用逗号分隔；Webhook 必须以 `http(s)://` 开头。
- 必填：应用方式的 App ID、App Secret 与用户 ID（或部门 ID）；群机器人方式的 Webhook。App Secret 与签名密钥在已有 Secret 时留空表示沿用。

## 边界情况

- 平台通知组件的校验 webhook 不可用：保存返回 400，页面显示上游错误（环境问题，自动化用例跳过并写明原因）。
- 没有 Secret 时 App Secret 视为必填；有 Secret 时留空沿用。
- 切换接入方式后保存只写当前方式；另一方式的历史凭据不在本次请求里（Secret 整体替换，与老 console 相同）。
- 群机器人方式下不存在 Config：徽标以 Receiver 是否存在判定「已配置」。
- 已保存的 Receiver 决定页面打开时的接入方式：有 `spec.feishu.chatbot` 即群机器人，有 `department` 即部门，否则用户。

## 明确不做

- 飞书应用与机器人的创建、审核（在飞书侧完成）。
- 通知条件（`alertSelector`）与消息模板（`template/tmplText/tmplType`）。
- 读取或显示已保存的凭据。

## 假设

- 平台已安装通知模块，`notification.kubesphere.io/v2beta2` 的 Config/Receiver 与 v2beta1 的 Secret 可读写。
- 平台通知组件工作正常；其校验 webhook 不可用时保存会 400，这是环境状态。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01** — 飞书页按接入方式渲染字段，并把所选方式写入 Config/Receiver/Secret 三个对象。
- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-02** — 未配置状态显式呈现；必填校验在发请求之前拦下。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01** — 三种接入方式的字段切换正确、空态徽标正确；平台可用时保存后三个对象可读回且页面回显已保存的值。
