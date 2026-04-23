---
title: "System Dashboard"
keywords: "Industry AI Model Platform, data tools, system dashboard, Celery, task monitoring"
description: "The system dashboard provides an overview of the running status of data collection, format conversion, and data processing task modules."
linkTitle: "System Dashboard"
weight: 7010
---

## Overview

The system dashboard provides a visual overview of the global running status of Data Tools (DataFlow), helping administrators and users quickly understand the status of each task module.

## Task Statistics

In **Data Tools → System Dashboard**, view the overall running status of these three task modules:

- **Data Collection**: Tasks for importing data from external sources
- **Format Conversion**: File format conversion tasks
- **Data Processing**: Tasks using operator Pipelines for data cleaning/augmentation

Each module displays the following status statistics:

| Status | Description |
|--------|-------------|
| Queued | Task submitted, waiting in queue |
| Processing | Task is running |
| Completed | Task finished successfully |
| Error | Task execution failed |

## Celery Node Service List

The dashboard also displays runtime information for all Celery worker nodes:

| Field | Description |
|-------|-------------|
| IP Address | Node network address |
| Current Task Count | Number of tasks the node is currently processing |
| Node Status | Online / Offline |
| Heartbeat Time | Most recent node heartbeat timestamp |

Administrators can monitor node loads from this page and manage abnormal nodes (e.g., remove failed nodes).

## Quick Actions

Click the **Create Task** button on the dashboard to quickly navigate to the new task page for the corresponding module.
