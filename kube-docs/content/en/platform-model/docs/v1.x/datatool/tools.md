---
title: "Tools"
keywords: "Industry AI Model Platform, data tools, tool pool, data analysis, format conversion tools, data generation"
description: "The tool pool aggregates specialized data processing tools for analysis, format conversion, data generation, and more."
linkTitle: "Tools"
weight: 7060
---

## Overview

The DataFlow tool pool is a multi-modal data processing system that helps make data higher quality, more valuable, and better suited for large model processing. Compared to operators in algorithm templates, tools in the pool are focused on specific data processing scenarios and support more complex preprocessing and postprocessing operations.

## Tool Categories

Tools are divided into **Internal Tools** and **External Tools**.

### Built-in Tool List

| Tool Name | Type | Description |
|-----------|------|-------------|
| **General Analysis Tool** | Analysis | Analyzes a dataset, calculates statistics for all filter operations, applies various analyses, and generates statistical tables and distribution charts |
| **Dataset Language Split Tool** | Preprocessing | Loads a dataset, applies language identification filtering, and splits/saves the dataset by language |
| **Dataset from Code Repository Tool** | Preprocessing | Prepares a dataset from a code repository in the format: repo name, file path, file content |
| **Raw arXiv to JSONL Tool** | Preprocessing | Converts raw arXiv data (gzipped tar files) to JSONL format |
| **Raw Stack Exchange to JSONL Tool** | Preprocessing | Converts Stack Exchange archive data to multiple JSONL files |
| **CSV NaN Value Reformatter** | Preprocessing | Handles CSV/TSV files containing NaN values |
| **JSONL NaN Value Reformatter** | Preprocessing | Reformats JSONL files containing NaN values for consistent loading |
| **Metadata Serializer** | Preprocessing | Serializes all non-specified fields in JSONL files to ensure consistent data loading |
| **MD to JSONL Tool** | Preprocessing | Converts Markdown files to JSONL format with chunking support |
| **Token Counter** | Postprocessing | Counts tokens in a dataset using a specified tokenizer (JSONL format only) |
| **Data Mixing Tool** | Postprocessing | Mixes multiple datasets into one; supports JSONL, JSON, Parquet formats |
| **Metadata Deserializer** | Postprocessing | Deserializes specified fields in JSONL files |
| **General Quality Classifier** | Analysis | Predicts document scores in a dataset, providing score and should_keep columns for each row |
| **URL Data Scraping Tool** | Preprocessing | LLM-based data scraping for websites and local documents (XML, HTML, JSON, etc.) |
| **PDF Data Extraction Tool** | Preprocessing | High-quality PDF to Markdown and JSON conversion tool |
| **Text Value Evaluation Tool** | Analysis | Scores and filters data based on user-defined criteria, with bloom filter deduplication |
| **High-Quality Dialogue Generation Tool** | Generation | Generates multi-turn dialogues using fixed prompts and retains the highest quality conversations |
| **Enhanced Text Description Tool** | Generation | Uses a large model to generate detailed descriptions from source data |

## Using Tools

1. In **Data Tools → Tools**, browse or search for the desired tool.
2. Click the **Use Tool** button on the tool card.
3. The system redirects to the new task page with the tool pre-selected.
4. Configure task parameters (data source, target dataset, tool parameters, etc.).
5. Submit for execution.

## Search and Filtering

Tools can be found using:

- **Search by tool name**: Enter keywords to search
- **Filter by category**: Filter by tool type (Analysis / Preprocessing / Postprocessing / Generation)
- **Internal/External tabs**: Switch between platform built-in tools and externally integrated tools
