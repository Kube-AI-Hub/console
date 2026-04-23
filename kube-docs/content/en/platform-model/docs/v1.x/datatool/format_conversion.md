---
title: "Format Conversion"
keywords: "Industry AI Model Platform, data tools, format conversion, Excel, Word, Markdown, JSON, Parquet"
description: "Format conversion supports converting Excel, Word, PPT files to JSON, CSV, Parquet, and Markdown formats."
linkTitle: "Format Conversion"
weight: 7030
---

## Overview

The format conversion module supports converting common office document formats to data formats frequently used in large model training, making it easy to transform enterprise documents into structured data for model training.

## Supported Conversions

| Source Format | Target Format |
|---------------|---------------|
| Excel (.xlsx / .xls) | JSON, CSV, Parquet |
| Word (.docx) | Markdown |
| PPT (.pptx) | Markdown |

## Creating a Format Conversion Task

1. In **Data Tools → Format Conversion**, click the **Create Task** button in the top right.
2. Fill in the task details:

| Parameter | Description |
|-----------|-------------|
| Task Description | Optional description of this conversion task |
| Data Source | Select source dataset and branch |
| Source Format | Format of files to convert (Excel / Word / PPT) |
| Target Format | Desired output format (JSON / CSV / Parquet / Markdown) |
| Destination Branch | Dataset branch where results will be saved |
| Generate Meta File | Optional; whether to generate a metadata description file |

3. Click **Start Execution** to launch the conversion task.

## Viewing Task Status

After submitting, the task list shows the current status:

| Status | Description |
|--------|-------------|
| Processing | Conversion task is running |
| Completed | Conversion succeeded |
| Failed | Conversion failed; check logs for details |

- Click **Details** to view task configuration and metadata
- Click **Logs** to view execution output and any error/warning messages

## Viewing Conversion Results

After a successful conversion, the converted files are available in the platform's **Personal Datasets**.

{{< notice note >}}
Conversion results are saved to the specified destination branch. If a conversion task fails, verify that the source file format is correct and check the logs for detailed error information.
{{</ notice >}}
