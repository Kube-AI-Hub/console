---
title: "Using Fine-tuning and Monitoring"
keywords: "Industry AI Model Platform, model fine-tuning, LLaMA-Factory, LlamaBoard, Notebook, training monitoring, billing"
description: "How to use fine-tuning instances on the Industry AI Model Platform for model training, including Web UI operation, Notebook development, training monitoring, and billing management."
linkTitle: "Using Fine-tuning and Monitoring"
weight: 6315
---

After the fine-tuning instance is created and reaches the **Running** state, you can perform model fine-tuning through either the Web UI or Notebook.

## Using the Web UI (LlamaBoard)

If you selected the **LLaMA-Factory** framework during instance creation, the system provides the LlamaBoard visual training interface, enabling no-code model fine-tuning.

### Steps

1. **Load Training Configuration**
   Click the **Open Web UI** button in the instance action bar to open the LlamaBoard training interface. Select the base model and fine-tuning method (e.g., LoRA, QLoRA, full-parameter fine-tuning) from the top section.

2. **Select Training Dataset**
   In the dataset configuration area, select a training dataset that has been uploaded to the platform. Both custom datasets and built-in platform datasets are supported.

3. **Adjust Hyperparameters**
   Adjust training hyperparameters based on your requirements:

   | Parameter | Description | Recommended Range |
   |-----------|-------------|-------------------|
   | **Batch Size** | Number of training samples per batch | Adjust based on VRAM, typically 4-16 |
   | **Learning Rate** | Learning rate | 1e-5 to 5e-4 |
   | **Epoch** | Number of training epochs | Typically 1-5 |
   | **LoRA Rank** | Dimension of LoRA low-rank matrices | 8, 16, or 32 |
   | **LoRA Alpha** | LoRA scaling coefficient | Usually 2× the Rank |

4. **Start Training**
   After configuration, click the **Start Fine-tuning** button to launch the training task. During training, you can view real-time loss curves and training progress in the interface.

{{< notice tip >}}
LlamaBoard automatically saves training configurations. For iterative experiments, you can quickly reload previous configurations and adjust parameters.
{{</ notice >}}

## Using Notebook

Click the **Launch Notebook** button in the instance action bar to open a JupyterLab development environment in your browser, giving you full control over training code and workflow.

Notebook mode is ideal for:

- Custom training scripts and data preprocessing logic
- Using MS-Swift or other framework CLI commands
- Fine-grained control over the training process
- Debugging model or dataset issues

{{< notice note >}}
The Notebook environment comes pre-installed with the relevant fine-tuning framework and dependencies. For additional packages, use `pip install` in the terminal.
{{</ notice >}}

## Training Monitoring

Click the instance name in the instance list to open the details page, then switch to the **Analysis** tab to view real-time training status and resource monitoring.

### Resource Monitoring

| Metric | Description |
|--------|-------------|
| **CPU Utilization** | System CPU usage percentage |
| **GPU Utilization** | GPU compute core usage |
| **Memory Usage** | System memory consumption |
| **VRAM Usage** | GPU memory allocation and usage |

### Training Metrics

| Metric | Description |
|--------|-------------|
| **Loss Curve** | Training loss trend over steps/epochs |
| **Learning Rate Schedule** | Actual learning rate changes from the scheduler |
| **Training Speed** | Samples or training steps processed per second |

Monitoring these metrics helps you determine whether training is progressing normally and identify issues such as overfitting, underfitting, or resource bottlenecks.

## View Billing Details

On the instance details page, switch to the **Billing** tab to view resource consumption details:

| Field | Description |
|-------|-------------|
| **Billing Start Time** | When the instance started consuming compute resources |
| **Billing End Time** | When the instance was stopped or resources were released |
| **Resource Spec** | GPU/CPU/memory configuration in use |
| **Accumulated Cost** | Total cost to date |

{{< notice warning >}}
Fine-tuning instances incur charges continuously while running. Even after a training task completes, charges continue as long as the instance is not stopped. **Stop** the instance promptly after training to avoid unnecessary costs.
{{</ notice >}}
