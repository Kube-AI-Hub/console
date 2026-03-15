---
title: "Feature Extraction"
keywords: "Industry AI Model Platform, feature extraction, embeddings, vector, semantic search"
description: "How to use dedicated inference instances for text feature extraction (Embeddings), including API usage."
linkTitle: "Feature Extraction"
weight: 6254
---

## Task Overview

Feature Extraction tasks convert text into high-dimensional vector representations (Embeddings). This is suitable for Embedding models (e.g., BGE, E5, text-embedding series) and is commonly used for semantic search, document retrieval, similarity computation, RAG, and other scenarios.

## API Usage

```bash
curl https://<instance-address>/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "model": "<model-name>",
    "input": "What is the core technology behind large language models?"
  }'
```

## Batch Extraction

```bash
curl https://<instance-address>/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{
    "model": "<model-name>",
    "input": [
      "First text passage",
      "Second text passage",
      "Third text passage"
    ]
  }'
```

## Response Format

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.023, -0.012, 0.045, ...]
    }
  ],
  "model": "<model-name>",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

## Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<instance-address>/v1",
    api_key="<access-token>"
)

response = client.embeddings.create(
    model="<model-name>",
    input=["First text passage", "Second text passage"]
)

for item in response.data:
    print(f"Index {item.index}: vector dimension {len(item.embedding)}")
```

## Use Cases

- **Semantic Search**: Convert both documents and queries to vectors, retrieve the most relevant documents by cosine similarity.
- **RAG (Retrieval-Augmented Generation)**: Build a vector index knowledge base to provide relevant context for large models.
- **Text Clustering**: Vectorize large volumes of text for cluster analysis.
- **Similarity Computation**: Calculate the semantic similarity between two text passages.

## Related Documentation

- [Create Dedicated Inference Instance](../endpoint_create)
