---
title: "Data Tools"
keywords: "Industry AI Model Platform, data tools, DataFlow, data processing, data cleaning, data labeling, format conversion, data collection"
description: "DataFlow is a one-stop data processing platform supporting data collection, format conversion, data cleaning and augmentation, and data labeling across the full data lifecycle."
linkTitle: "Data Tools"
weight: 7000
icon: "/images/docs/platform-model/dataset.svg"
---

## What are Data Tools

Data Tools (DataFlow) is a one-stop data processing platform that enables full lifecycle management from data to model, driving continuous optimization. It supports multiple data formats and sources including local files, cloud data, and databases, and provides efficient transformation and processing tools to ensure data consistency. Customizable Pipelines enable complex data cleaning and transformation with parallel processing for efficiency. Additionally, an integrated labeling system supports collaborative annotation with permission and review mechanisms to ensure labeling accuracy and data quality.

Data Tools are deeply integrated with the platform's dataset management — data processing requires an existing platform dataset as the target, and all processing results are saved directly to dataset repositories.

## Feature Modules

| Module | Description |
|--------|-------------|
| [System Dashboard](./dashboard) | View overall running status of data collection, format conversion, and data processing tasks |
| [Data Collection](./data_collection) | Import data from MySQL, MongoDB, files, Hive, and other sources |
| [Format Conversion](./format_conversion) | Convert Excel→JSON/CSV/Parquet, Word/PPT→Markdown, and more |
| [Data Processing](./data_processing) | Configure operator Pipelines via a visual workflow editor for data cleaning and augmentation |
| [Algorithm Templates](./algorithm_template) | Built-in and custom data processing algorithm templates for reuse and sharing |
| [Tools](./tools) | A collection of specialized data processing tools for analysis, conversion, and generation |
| [Data Labeling](./data_labeling) | Integrated Label Studio for multi-modal annotation of text, images, audio, and video |

## Quick Start

1. Create or select a dataset on the platform to use as the data source and result storage target
2. Navigate to **Data Tools** in the top navigation
3. Choose the appropriate feature based on your needs:
   - Import external data → [Data Collection](./data_collection)
   - Convert file formats → [Format Conversion](./format_conversion)
   - Clean/augment data → [Data Processing](./data_processing)
   - Label data → [Data Labeling](./data_labeling)
