---
title: "文本生成"
keywords: "行业大模型平台, 文本生成, Text Generation, API, 推理"
description: "介绍如何使用专属推理实例进行文本生成任务，包括对话补全和 API 调用说明。"
linkTitle: "文本生成"
weight: 6251
---

## 任务说明

文本生成（Text Generation）是最常见的大语言模型推理任务，包括对话补全、文本续写、代码生成等场景。平台的专属推理实例提供兼容 OpenAI 格式的 API 接口。

## API 调用

### 对话补全（Chat Completions）

```bash
curl https://<实例地址>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <访问令牌>" \
  -d '{
    "model": "<模型名称>",
    "messages": [
      {"role": "system", "content": "你是一个有帮助的助手。"},
      {"role": "user", "content": "请介绍一下大语言模型。"}
    ],
    "temperature": 0.7,
    "max_tokens": 512
  }'
```

### 文本补全（Completions）

```bash
curl https://<实例地址>/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <访问令牌>" \
  -d '{
    "model": "<模型名称>",
    "prompt": "大语言模型是",
    "max_tokens": 200
  }'
```

## Python 示例

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<实例地址>/v1",
    api_key="<访问令牌>"
)

response = client.chat.completions.create(
    model="<模型名称>",
    messages=[
        {"role": "user", "content": "请介绍一下大语言模型。"}
    ]
)
print(response.choices[0].message.content)
```

## 常用参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `temperature` | float | 生成随机性，范围 0～2，越低越确定性，默认 1.0 |
| `max_tokens` | int | 生成的最大 token 数量 |
| `top_p` | float | 核采样概率，与 temperature 配合使用 |
| `stream` | bool | 是否使用流式输出，默认 false |

## 相关文档

- [创建专属推理实例](../endpoint_create)
