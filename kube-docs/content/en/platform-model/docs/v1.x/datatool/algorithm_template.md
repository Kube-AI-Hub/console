---
title: "Algorithm Templates"
keywords: "Industry AI Model Platform, data tools, algorithm templates, built-in templates, custom templates, operators"
description: "Algorithm templates allow users to save common data processing Pipelines as reusable templates, with support for both built-in and custom templates."
linkTitle: "Algorithm Templates"
weight: 7050
---

## Overview

Algorithm templates allow users to combine various model operators into workflows for data cleaning, automated data augmentation, and analysis. The platform provides several built-in templates, and users can also create custom templates or modify built-in ones to build personalized data processing Pipelines.

## Built-in Templates

| Template Type | Description |
|---------------|-------------|
| **Data Cleaning - Basic** | Basic cleaning operators including text normalization, special content removal, and length filtering |
| **Data Cleaning - Advanced** | Extends basic cleaning with repetition rate filtering, language filtering, and other advanced operators |
| **Data Augmentation** | Automatically generates more training data from seed data, supporting text classification, extraction, and generation scenarios |

### Data Augmentation Template Types

| Type | Description |
|------|-------------|
| **Text Classification** | Augments training data for text classification tasks: sentiment classification, label classification, product categorization |
| **Text Extraction** | Augments training data for text extraction tasks: format extraction, entity extraction, element extraction |
| **Text Generation** | Augments training data for text creation tasks: news writing, ad copy generation, content style transformation |

## Using Built-in Templates

1. In **Data Tools → Algorithm Templates → Built-in Templates**, browse available templates.
2. Click the **Use** button on a template card to create a data processing task from it directly.
3. Or click **Copy** to create a customizable version of the template.

## Creating Custom Templates

1. In **Algorithm Templates → Custom Templates**, click the **Custom Template** button.
2. Fill in the template details:

| Parameter | Description |
|-----------|-------------|
| Template Name | Unique identifier; must not duplicate existing template names |
| Task Type | Data Cleaning / Data Augmentation / Data Generation |
| Template Description | Describe the template's purpose and applicable scenarios |

3. In the workflow editor, select the **operators** to use and set their **execution order**.
4. Configure parameters for each operator (some have required parameters).
5. Click **Create** to save the template.

## Managing Custom Templates

| Action | Description |
|--------|-------------|
| **Use** | Create a data processing task from the template |
| **Edit** | Modify the template configuration |
| **Copy** | Create a copy of the template |
| **Delete** | Remove templates that are no longer needed |

## Operator Management

Platform administrators can configure operator permissions in **Operator Management**, controlling which users or organizations can use specific operators.

Each operator supports:

- **Operator Documentation**: Upload a Markdown description document for the operator
- **Authorized Users**: Set usage permissions by individual or organization

{{< notice note >}}
Custom templates can be published as new templates for sharing with other users. When creating a data processing task, published templates can be selected as a Pipeline starting point.
{{</ notice >}}
