---
title: "使用公共推理服务"
keywords: "行业大模型平台, 公共推理服务, Playground, 云端模型, 思考模式, API"
description: "介绍如何在公共推理服务中测试和调用本地部署与云端 API 模型。"
linkTitle: "使用公共推理服务"
weight: 6230
---

## 打开公共模型

1. 通过顶部导航进入 **模型推理 → 公共推理服务**。
2. 卡片展示模型 ID、接入方式（本地显示框架和规格，云端显示厂商）以及运行状态。
3. 点击卡片进入详情。云端模型详情显示 **推理 API URL**、**云端服务商** 和接入方式 **云端**；本地部署显示副本范围和资源配置。
4. 云端模型没有对应的平台仓库链接。

## Playground 测试

服务处于 **Running** 后，详情页提供对话测试：

1. 输入提示词，按需调整 Temperature、Top-P、Max Tokens。云端兼容通道通常只接受 **Max Tokens**，其余采样参数由上游固定。
2. 使用**思考模式**开关：
   - **本地部署**：关闭时发送 `chat_template_kwargs.enable_thinking=false`。
   - **云端 API**：发送 `reasoning_effort` 为 `high`（开）或 `low`（关）。部分云端模型（如 Kimi K3）无法完全关闭思考，`low` 只降低思考强度。
3. 支持思考的回复会单独展示思考过程。

## API 调用

在详情页切换到 **API** 页签，可查看当前服务的调用地址和示例。

### 本地部署

地址为该共享实例的推理 URL，用法与[推理实例 API](./endpoint_usage) 相同。私有服务需携带访问令牌。

### 云端 API

云端模型统一走控制台网关，请求体中的 `model` 必须是管理员在通道里登记的**平台模型 ID**（不一定等于上游真实 ID）：

```bash
curl https://<控制台地址>/aigateway/v1/chat/completions \
  -H "Authorization: Bearer <访问令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<平台模型 ID>",
    "messages": [{"role": "user", "content": "你好"}],
    "reasoning_effort": "high"
  }'
```

部分部署路径为 `/platform-model/aigateway/v1/chat/completions`，以详情页显示的 **推理 API URL** 为准。

{{< notice note >}}
云端通道默认需要访问令牌，可在 **个人设置 → 访问令牌** 中生成。网关按管理员配置的**模型映射**把平台 ID 换成上游 ID，调用方不必感知上游名称。
{{</ notice >}}

## 查看监控与请求日志

公共推理服务中的**本地共享部署**与推理实例使用同一套观测能力，详见[使用推理实例](./endpoint_usage)：

- **分析**页签：资源与流量指标，以及 TTFT、输出速率、Token 量、缓存命中量与命中率等大模型服务 SLA 曲线；
- **日志**页签：容器日志与**请求日志**——每次调用一行，含 TTFT、输入/输出 Token、**缓存命中量**与输出速率，可按时间范围与用户筛选。

云端 API 模型由上游服务商提供，不提供上述引擎级监控与请求日志。

{{< notice note >}}
**请求日志里缓存命中量一直是 0？** 前缀缓存按块匹配，提示词不足一个块（本平台实测 **544** token）时不可能命中，这类 0 属正常，不是采集失败。判断与复现方法见[模型推理常见问题](./endpoint_faq)。
{{</ notice >}}

## 相关文档

- [公共推理服务介绍](./serverless_intro)
- [管理公共推理服务](./serverless_admin)
- [使用推理实例](./endpoint_usage)
