---
title: "图像文本生成"
keywords: "行业大模型平台, 图像文本生成, Image Text to Text, 多模态, 视觉语言模型"
description: "介绍如何使用专属推理实例进行图像文本生成任务（多模态理解），包括 API 调用说明。"
linkTitle: "图像文本生成"
weight: 6253
---

## 任务说明

图像文本生成（Image Text to Text）任务以图像和文本作为联合输入，生成文本输出，适用于视觉语言模型（VLM），如图像问答、图像描述、OCR 理解等场景。

## API 调用

使用多模态对话补全接口，在 `messages` 中通过 `content` 数组传入图像和文本：

```bash
curl https://<实例地址>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <访问令牌>" \
  -d '{
    "model": "<模型名称>",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image_url",
            "image_url": {
              "url": "https://example.com/image.jpg"
            }
          },
          {
            "type": "text",
            "text": "请描述这张图片的内容。"
          }
        ]
      }
    ]
  }'
```

## 传入 Base64 编码图像

```bash
curl https://<实例地址>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <访问令牌>" \
  -d '{
    "model": "<模型名称>",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/jpeg;base64,<base64编码内容>"
            }
          },
          {
            "type": "text",
            "text": "图中有哪些文字？"
          }
        ]
      }
    ]
  }'
```

## Python 示例

```python
import base64
from openai import OpenAI

client = OpenAI(
    base_url="https://<实例地址>/v1",
    api_key="<访问令牌>"
)

# 读取本地图片并编码
with open("image.jpg", "rb") as f:
    image_data = base64.b64encode(f.read()).decode("utf-8")

response = client.chat.completions.create(
    model="<模型名称>",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
                },
                {
                    "type": "text",
                    "text": "请描述这张图片的内容。"
                }
            ]
        }
    ]
)
print(response.choices[0].message.content)
```

## 相关文档

- [创建专属推理实例](../endpoint_create)
