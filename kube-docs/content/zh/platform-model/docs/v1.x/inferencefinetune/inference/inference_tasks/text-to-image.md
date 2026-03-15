---
title: "文本生成图像"
keywords: "行业大模型平台, 文本生成图像, Text to Image, 图像生成, API"
description: "介绍如何使用专属推理实例进行文本生成图像任务，包括 API 调用说明。"
linkTitle: "文本生成图像"
weight: 6252
---

## 任务说明

文本生成图像（Text to Image）任务根据文字描述（Prompt）生成对应的图像，适用于 Stable Diffusion、FLUX 等图像生成模型。

## API 调用

```bash
curl https://<实例地址>/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <访问令牌>" \
  -d '{
    "model": "<模型名称>",
    "prompt": "a beautiful mountain landscape at sunset, photorealistic",
    "n": 1,
    "size": "1024x1024"
  }'
```

## 响应格式

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://...",
      "b64_json": "..."
    }
  ]
}
```

响应中包含生成图像的 URL 或 Base64 编码内容（取决于请求中的 `response_format` 参数）。

## Python 示例

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<实例地址>/v1",
    api_key="<访问令牌>"
)

response = client.images.generate(
    model="<模型名称>",
    prompt="a beautiful mountain landscape at sunset, photorealistic",
    n=1,
    size="1024x1024"
)
print(response.data[0].url)
```

## 常用参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `prompt` | string | 图像描述文本 |
| `n` | int | 生成图像数量，默认 1 |
| `size` | string | 图像尺寸，如 `512x512`、`1024x1024` |
| `response_format` | string | 返回格式：`url` 或 `b64_json` |

## 相关文档

- [创建专属推理实例](../endpoint_create)
