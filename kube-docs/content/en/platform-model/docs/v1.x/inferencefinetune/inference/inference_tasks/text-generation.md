---
title: "Text Generation"
keywords: "Industry AI Model Platform, text generation, API, inference"
description: "How to use dedicated inference instances for text generation tasks, including conversation completion and API usage."
linkTitle: "Text Generation"
weight: 6251
---

## Task Overview

Text Generation is the most common large language model inference task, covering conversation completion, text continuation, code generation, and more. The platform's dedicated inference instances provide an OpenAI-compatible API interface.

## API Usage

### Chat Completions

```bash
curl https://<instance-address>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "model": "<model-name>",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain large language models briefly."}
    ],
    "temperature": 0.7,
    "max_tokens": 512
  }'
```

### Text Completions

```bash
curl https://<instance-address>/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "model": "<model-name>",
    "prompt": "Large language models are",
    "max_tokens": 200
  }'
```

## Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<instance-address>/v1",
    api_key="<access-token>"
)

response = client.chat.completions.create(
    model="<model-name>",
    messages=[
        {"role": "user", "content": "Explain large language models briefly."}
    ]
)
print(response.choices[0].message.content)
```

## Common Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature` | float | Generation randomness, range 0–2; lower is more deterministic; default 1.0 |
| `max_tokens` | int | Maximum number of tokens to generate |
| `top_p` | float | Nucleus sampling probability; used together with temperature |
| `stream` | bool | Whether to use streaming output; default false |

## Related Documentation

- [Create Dedicated Inference Instance](../endpoint_create)
