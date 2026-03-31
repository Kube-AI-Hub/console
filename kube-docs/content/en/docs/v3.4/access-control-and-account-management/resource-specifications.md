---
title: "Resource Specifications"
keywords: "Kube AI Hub, resource specifications, GPU specs, compute specs"
description: "Learn how to create and manage compute resource specification templates in Kube AI Hub."
linkTitle: "Resource Specifications"
weight: 3200
---

## Overview

The Resource Specifications feature allows platform administrators to pre-define compute resource specification templates, including CPU, memory, disk, and GPU configurations. When users create container instances (such as Notebooks, inference instances, or fine-tuning instances), they can directly select a pre-defined specification instead of manually filling in resource parameters, simplifying the workflow and standardizing resource usage.

## Use Cases

- **Standardized resource allocation**: Define standard specifications for different workload types (e.g., development, training, inference)
- **Simplified user experience**: Users don't need to understand low-level resource configuration details — just select a specification
- **Cost control**: Limit the maximum resources users can request through pre-defined specifications

## Creating Resource Specifications

1. Log in as a platform administrator.
2. Navigate to **Platform Management → Resource Specifications**.
3. Click the **Create Specification** button.
4. Fill in the specification details:

| Parameter | Description |
|-----------|-------------|
| **Name** | Custom name for easy identification (e.g., "Dev-4C8G", "Training-A100-80G") |
| **CPU** | CPU core count configuration |
| **Memory** | Memory size configuration (GiB) |
| **GPU Model** | Optional; specify a GPU model (e.g., A100, V100) |
| **GPU Count** | Optional; number of GPU cards |
| **GPU Memory** | Optional; VRAM allocation per GPU card |

5. Click **OK** to complete creation.

## Managing Specifications

In the specification management list, you can perform the following operations on existing specifications:

- **View**: View detailed configuration of a specification
- **Edit**: Modify resource configuration parameters
- **Delete**: Remove specifications that are no longer needed

{{< notice note >}}
Deleting a specification does not affect instances already created using it. Running instances continue with their original resource configuration.
{{</ notice >}}

## Using Specifications

After specifications are created, users can select them in the following scenarios:

- When creating a Notebook development instance, select a specification in the **Resource Configuration** step
- When creating a dedicated model inference instance, select a compute specification
- When creating a model fine-tuning instance, select a GPU resource specification
- When creating an application Space, select a cloud resource specification

After selecting a specification, the system automatically populates the corresponding CPU, memory, GPU, and other resource configuration parameters.
