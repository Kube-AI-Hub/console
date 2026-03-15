---
title: "Text to Image"
keywords: "Industry AI Model Platform, text to image, image generation, API"
description: "How to use dedicated inference instances for text-to-image generation tasks, including API usage."
linkTitle: "Text to Image"
weight: 6252
---

## Task Overview

Text to Image tasks generate images from text descriptions (prompts), suitable for image generation models such as Stable Diffusion and FLUX.

## API Usage

```bash
curl https://<instance-address>/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "model": "<model-name>",
    "prompt": "a beautiful mountain landscape at sunset, photorealistic",
    "n": 1,
    "size": "1024x1024"
  }'
```

## Response Format

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

The response contains the generated image as a URL or Base64-encoded content (depending on the `response_format` parameter in the request).

## Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<instance-address>/v1",
    api_key="<access-token>"
)

response = client.images.generate(
    model="<model-name>",
    prompt="a beautiful mountain landscape at sunset, photorealistic",
    n=1,
    size="1024x1024"
)
print(response.data[0].url)
```

## Common Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | Image description text |
| `n` | int | Number of images to generate; default 1 |
| `size` | string | Image dimensions, e.g., `512x512`, `1024x1024` |
| `response_format` | string | Return format: `url` or `b64_json` |

## Related Documentation

- [Create Dedicated Inference Instance](../endpoint_create)
