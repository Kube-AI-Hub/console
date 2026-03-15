---
title: "Image Text to Text"
keywords: "Industry AI Model Platform, image text to text, multimodal, vision language model, VLM"
description: "How to use dedicated inference instances for image-text-to-text tasks (multimodal understanding), including API usage."
linkTitle: "Image Text to Text"
weight: 6253
---

## Task Overview

Image Text to Text tasks take image and text as joint inputs and generate text output. This is suitable for Vision Language Models (VLMs) in scenarios such as image Q&A, image captioning, and OCR understanding.

## API Usage

Use the multimodal chat completions endpoint, passing both image and text in the `messages` content array:

```bash
curl https://<instance-address>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "model": "<model-name>",
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
            "text": "Describe the content of this image."
          }
        ]
      }
    ]
  }'
```

## Passing Base64-Encoded Images

```bash
curl https://<instance-address>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "model": "<model-name>",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/jpeg;base64,<base64-encoded-content>"
            }
          },
          {
            "type": "text",
            "text": "What text appears in this image?"
          }
        ]
      }
    ]
  }'
```

## Python Example

```python
import base64
from openai import OpenAI

client = OpenAI(
    base_url="https://<instance-address>/v1",
    api_key="<access-token>"
)

# Read and encode local image
with open("image.jpg", "rb") as f:
    image_data = base64.b64encode(f.read()).decode("utf-8")

response = client.chat.completions.create(
    model="<model-name>",
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
                    "text": "Describe the content of this image."
                }
            ]
        }
    ]
)
print(response.choices[0].message.content)
```

## Related Documentation

- [Create Dedicated Inference Instance](../endpoint_create)
