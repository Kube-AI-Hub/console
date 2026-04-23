---
title: "Data Labeling"
keywords: "Industry AI Model Platform, data tools, data labeling, Label Studio, multi-modal annotation"
description: "The data labeling feature integrates Label Studio to support annotation tasks for text, images, audio, video, and other multi-modal data."
linkTitle: "Data Labeling"
weight: 7070
---

## Overview

The data labeling feature is deeply integrated with **Label Studio** — a powerful and flexible open-source data annotation tool. Through deep integration with the platform's dataset management module, all data import, management, and export is handled within the platform, providing unified data flow and a one-stop labeling experience.

## Key Advantages

- **Ready to Use**: No separate Label Studio installation needed — open it directly within the platform
- **Unified Data Management**: All data import and export is handled through the platform's dataset management, ensuring consistency and traceability
- **Multi-modal Support**: Supports labeling of text, images, audio, video, HTML, and multi-sensor data
- **Multi-format Export**: Annotation results can be exported in multiple formats for model training or sharing
- **Flexible Configuration**: Supports Label Studio built-in annotation templates as well as custom labels and interfaces

## Workflow

### Step 1: Open the Labeling Tool

In **Data Tools → Data Labeling**, click to open the labeling tool. The system calls the backend interface (`/dataflow/studio/jump-to-studio`) to generate an access link and opens the Label Studio workspace in a new tab.

### Step 2: Create a Labeling Project

In Label Studio, create a new project:

1. Enter a **project name**
2. Save the project to begin the new labeling task

### Step 3: Import Data

Import data for labeling from your platform dataset:

1. In the Label Studio project, select **Import Data**
2. Choose the **data branch** from the platform dataset and import
3. Wait for data loading to complete

### Step 4: Configure the Labeling Interface

After import, set up the labeling configuration:

- **Use built-in templates**: Label Studio provides templates for text classification, NER, image classification, object detection, and more for quick setup
- **Custom labels**: Define custom label types and annotation interfaces based on business requirements

### Step 5: Perform Annotation

Once configured, begin labeling data item by item. Supported workflows:

- Single-annotator labeling
- Multi-person collaborative annotation (distribute tasks via project member management)
- Model-assisted pre-labeling (use model inference results to improve efficiency)

### Step 6: Export Results

After labeling is complete, export results and save to the platform dataset:

1. Select **Export** in Label Studio
2. Choose an export format (JSON, CSV, etc.)
3. Results are automatically saved to the platform dataset with the branch suffix `_label`

## Supported Annotation Types

| Data Type | Typical Annotation Tasks |
|-----------|--------------------------|
| Text | Text classification, named entity recognition, relation extraction, sentiment analysis, text summarization |
| Image | Image classification, object detection, image segmentation, keypoint annotation |
| Audio | Speech recognition, audio classification, speech segmentation |
| Video | Video classification, action recognition, temporal annotation |
| Multimodal | Image-text pair annotation, visual question answering dataset construction |

{{< notice note >}}
For advanced Label Studio features such as complex template configuration, collaborative annotation, and model-assisted labeling, refer to the [Label Studio official documentation](https://labelstud.io/guide/).
{{</ notice >}}
