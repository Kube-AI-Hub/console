---
title: "特征提取"
keywords: "行业大模型平台, 特征提取, Feature Extraction, Embeddings, 向量化"
description: "介绍如何使用推理实例进行文本特征提取（Embeddings），包括 API 调用说明。"
linkTitle: "特征提取"
weight: 6254
---

## 任务说明

特征提取（Feature Extraction）任务将文本转换为高维向量表示（Embeddings），适用于 Embedding 模型（如 BGE、E5、text-embedding 系列），常用于语义搜索、文档检索、相似度计算、RAG 等场景。

## API 调用

```bash
curl https://<实例地址>/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <访问令牌>" \
  -d '{
    "model": "<模型名称>",
    "input": "大语言模型的核心技术是什么？"
  }'
```

## 批量提取

```bash
curl https://<实例地址>/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <访问令牌>" \
  -d '{
    "model": "<模型名称>",
    "input": [
      "第一段文本",
      "第二段文本",
      "第三段文本"
    ]
  }'
```

## 响应格式

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
  "model": "<模型名称>",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

## Python 示例

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<实例地址>/v1",
    api_key="<访问令牌>"
)

response = client.embeddings.create(
    model="<模型名称>",
    input=["第一段文本", "第二段文本"]
)

for item in response.data:
    print(f"索引 {item.index}: 向量维度 {len(item.embedding)}")
```

## 使用场景

- **语义搜索**：将文档和查询都转换为向量，通过余弦相似度检索最相关文档。
- **RAG（检索增强生成）**：构建知识库向量索引，为大模型提供相关上下文。
- **文本聚类**：对大量文本进行向量化后聚类分析。
- **相似度计算**：计算两段文本的语义相似度。

## 相关文档

- [创建推理实例](../endpoint_create)
