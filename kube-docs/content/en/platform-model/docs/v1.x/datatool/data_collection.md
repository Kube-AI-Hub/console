---
title: "Data Collection"
keywords: "Industry AI Model Platform, data tools, data collection, MySQL, MongoDB, data source"
description: "The data collection feature supports importing data from MySQL, MongoDB, files, Hive, and other sources into platform datasets."
linkTitle: "Data Collection"
weight: 7020
---

## Overview

The data collection module supports importing data from multiple external sources and syncing results to platform dataset repositories, providing a data foundation for downstream processing and model training.

## Supported Data Source Types

| Type | Description |
|------|-------------|
| **Relational Database (MySQL)** | Bulk import of database tables with custom table and field selection |
| **Non-relational Database (MongoDB)** | Import non-relational data with collection, field selection, and schema transformation |
| **File Data Import** | Import files in CSV, Excel, JSON, and other formats |
| **Hive System Import** | Efficiently read data stored in Hive systems |

## Adding a Data Source

In **Data Tools → Data Collection → Data Source Management**, click **Add Data Source** and fill in the connection details:

| Parameter | Description |
|-----------|-------------|
| Data Source Name | Custom name for easy identification |
| Data Source Type | MySQL / MongoDB / File Data / Hive |
| Server Address | Database server IP or hostname |
| Port | Database connection port |
| Database Name | Target database name |
| Username / Password | Database authentication credentials |
| Auth Type | None / LDAP / Kerberos |

After filling in the details, click **Test Connection** to verify connectivity.

## Creating a Data Collection Task

1. After a successful connection, the system automatically queries all tables in the database.
2. Select the **tables** and **fields** to import.
3. Configure the **data destination** (target dataset) and **branch** (created automatically if it doesn't exist).
4. Choose an execution mode:
   - **Execute Immediately**: Run as soon as submitted
   - **Scheduled Task**: Set a specific time for automatic execution
   - **Save Configuration Only**: Trigger manually later
5. Click **Save and Execute** or **Save Configuration**.

## Viewing Task Status

In the **Data Collection Tasks** list, each task shows:

| Field | Description |
|-------|-------------|
| Task Name | Custom task identifier |
| Data Source Type | Source database type |
| Connection Status | Normal / Pending Test / Anomaly |
| Last Updated | Most recent sync time |
| Records Imported / Total | Data import progress |

Click **Details** to view task configuration, or **Logs** to review execution output and errors.

## Viewing Import Results

After successful collection, imported data files are available in the platform's **Personal Datasets**.

{{< notice note >}}
Ensure you have created a target dataset repository on the platform before running data collection. If the specified destination branch doesn't exist, it will be created automatically.
{{</ notice >}}
