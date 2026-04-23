---
title: "Data Processing"
keywords: "Industry AI Model Platform, data tools, data processing, data cleaning, data augmentation, operators, Pipeline, workflow"
description: "The data processing module supports configuring Mapper, Filter, Deduplicator operator Pipelines via a visual workflow editor for large model training data cleaning, augmentation, and deduplication."
linkTitle: "Data Processing"
weight: 7040
---

## Overview

The data processing module allows users to combine data processing operators (Mapper, Filter, Deduplicator, Selector) into Pipelines using a **visual workflow editor**, enabling cleaning, augmentation, deduplication, and quality filtering of large model training data.

## Task Types

| Type | Description |
|------|-------------|
| **Data Cleaning (data_refine)** | Clean data through deduplication, desensitization, and other operators to meet usage requirements |
| **Data Augmentation (data_enhancement)** | Automatically generate more training data from seed data, supporting custom parameters and Prompts |
| **Data Generation (data_generation)** | Use models to generate specific types of training data |

## Creating a Data Processing Task

In **Data Tools → Data Processing**, click **Create Task** and configure as follows:

### Step 1: Basic Configuration

| Parameter | Description |
|-----------|-------------|
| Task Name | Custom task identifier |
| Task Type | Operator task or tool task |
| Data Source | Select source dataset and branch |
| Data Destination | Select the target dataset for processed results |
| Destination Branch | Target branch for results (auto-created if not present) |

### Step 2: Workflow Configuration

Use the **visual workflow editor** to configure the processing Pipeline:

1. **Drag** operator nodes from the left panel to the canvas
2. Click a node's **connection point** and drag to another node to establish processing order
3. Click a node to configure its parameters (some operators have required parameters)
4. Use zoom, reset view, and clear canvas controls to manage the workspace

**Workflow operation guide:**
- Drag nodes from the left panel to the canvas
- Click connection points and drag to other nodes to create links
- Drag nodes to reposition them
- Hover over a node to reveal the delete button
- Press Delete to remove a selected node

### Step 3: Data Export Configuration

Configure how processed data should be saved:

- **Push to original dataset**: Push as a new commit to the original dataset repository
- **Push to new dataset**: Save processed results to a specified new dataset

## Operator Types

The platform supports four operator types:

| Type | Description |
|------|-------------|
| **Mapper** | Transform each data sample (text normalization, format conversion, etc.) |
| **Filter** | Filter data by conditions, retaining samples that meet criteria |
| **Deduplicator** | Remove duplicate data |
| **Selector** | Select a specific subset of samples from the dataset |

Common operators:

| Operator | Type | Function |
|----------|------|----------|
| Text Normalization | Mapper | Unicode text normalization and traditional-to-simplified Chinese conversion |
| Special Content Removal | Mapper | Remove URLs, invisible characters, HTML tags, etc. |
| Chinese Character Conversion | Mapper | Convert between traditional/simplified Chinese and Japanese kanji |
| Text Replacement | Mapper | Replace content matching regex patterns |
| Sentence Split | Mapper | Split text into sentences |
| Text Length Filter | Filter | Keep samples within specified length range |
| Special Character Ratio Filter | Filter | Filter samples with excessive special characters |
| N-Gram Repetition Filter | Filter | Filter samples with excessive repetition rates |
| Language Confidence Filter | Filter | Retain samples in a specific language |
| MD5 Deduplication | Deduplicator | Exact-match deduplication |
| SimHash Deduplication | Deduplicator | Similarity-based deduplication |
| MinHashLSH Deduplication | Deduplicator | Efficient approximate deduplication |
| Random Selector | Selector | Randomly select data samples |

## Viewing Task Status and Results

After submitting, the task list shows:

| Field | Description |
|-------|-------------|
| Task Name | Task identifier |
| Task Type | Operator task / Tool task |
| Running Status | Queued / Processing / Completed / Failed |
| Data Source | Source dataset information |
| Data Destination | Target dataset information |

- Click **Details** to view before/after Session comparisons and processed data counts
- Click **Logs** to review execution logs
- After completion, click **Processing Results** to view the processed data

{{< notice tip >}}
It is recommended to validate your Pipeline configuration on a small data sample before processing the full dataset. Pipelines can be saved as [Algorithm Templates](./algorithm_template) for future reuse.
{{</ notice >}}
