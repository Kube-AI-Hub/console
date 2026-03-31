---
title: "使用专属推理实例"
keywords: "行业大模型平台, 专属推理, 推理 API, Playground, 模型监控, 计费"
description: "介绍如何使用行业大模型平台的专属推理实例，包括 API 调用、Playground 测试、实时监控和计费管理。"
linkTitle: "使用专属推理实例"
weight: 6215
---

## 概览页面

实例部署成功并进入 **Running** 状态后，点击实例名称进入概览页面，可查看以下信息：

| 字段 | 说明 |
|------|------|
| **推理 API 地址** | 实例提供的推理服务 URL，可直接用于 API 调用 |
| **运行状态** | 当前实例的运行状态（Running、Stopped、Error 等） |
| **推理框架** | 创建时选择的推理框架（如 vLLM、SGLang、TGI 等） |
| **资源配置** | 分配的 GPU/CPU/内存资源规格 |
| **副本数量** | 当前运行的推理服务副本数 |

## Playground 测试

平台提供交互式 Playground（沙箱）功能，无需编写代码即可测试模型推理效果：

1. 在实例详情页切换到 **Playground** 页签。
2. 在输入框中输入提示词（Prompt）。
3. 调整推理参数（如 Temperature、Top-P、Max Tokens 等）。
4. 点击**发送**按钮，查看模型推理结果。

{{< notice tip >}}
Playground 适用于快速验证模型效果和调试提示词，正式生产环境建议通过 API 调用。
{{</ notice >}}

## API 调用文档

在实例详情页切换到 **API** 页签，可查看完整的 API 调用文档及多语言代码示例。

### Python 示例

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://<your-endpoint-url>/v1"
)

response = client.chat.completions.create(
    model="your-model-name",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "你好，请介绍一下你自己。"}
    ],
    temperature=0.7,
    max_tokens=512
)

print(response.choices[0].message.content)
```

### JavaScript 示例

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "YOUR_API_KEY",
  baseURL: "https://<your-endpoint-url>/v1",
});

const response = await client.chat.completions.create({
  model: "your-model-name",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "你好，请介绍一下你自己。" },
  ],
  temperature: 0.7,
  max_tokens: 512,
});

console.log(response.choices[0].message.content);
```

### cURL 示例

```bash
curl -X POST "https://<your-endpoint-url>/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-model-name",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "你好，请介绍一下你自己。"}
    ],
    "temperature": 0.7,
    "max_tokens": 512
  }'
```

{{< notice note >}}
将示例中的 `<your-endpoint-url>` 替换为概览页面中显示的推理 API 地址，`YOUR_API_KEY` 替换为平台生成的 API 密钥。
{{</ notice >}}

## 实时监控

在实例详情页切换到**分析**页签，可查看实时运行指标：

| 监控指标 | 说明 |
|----------|------|
| **CPU 利用率** | 各副本的 CPU 使用百分比 |
| **GPU 利用率** | GPU 计算核心的使用率 |
| **内存使用量** | 系统内存的占用情况 |
| **显存使用量** | GPU 显存的分配和使用情况 |
| **推理延迟** | 请求到返回结果的平均响应时间 |
| **吞吐量** | 每秒处理的推理请求数 |

监控数据可帮助评估模型服务的运行状态，并为资源扩缩容提供依据。

## 查看运行日志

在**分析**页签中，还可以查看每个副本的运行日志，包括模型加载信息、请求处理记录和错误信息，便于排查推理服务中的问题。

## 查看计费详情

在实例详情页切换到**计费**页签，查看资源使用和费用明细：

| 字段 | 说明 |
|------|------|
| **计费开始时间** | 实例开始占用算力的时间 |
| **计费结束时间** | 实例停止或释放资源的时间 |
| **资源规格** | 当前使用的算力配置 |
| **累计费用** | 截至当前的总费用 |

## 停止与删除实例

{{< notice warning >}}
推理实例在运行期间持续计费。为避免不必要的费用，请在不使用时及时**停止**实例。如果确认不再需要，可**删除**实例以永久释放资源。删除操作不可恢复。
{{</ notice >}}

- **停止**：暂停推理服务，保留实例配置，计费暂停，可随时重新启动。
- **删除**：永久移除实例及所有关联资源，操作不可逆。
