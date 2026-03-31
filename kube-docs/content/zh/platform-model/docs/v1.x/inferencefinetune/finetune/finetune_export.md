---
title: "导出微调模型"
keywords: "行业大模型平台, 导出微调模型, LoRA 合并, LLaMA-Factory, MS-Swift, 模型推送"
description: "介绍如何在行业大模型平台导出微调后的模型，包括通过 LLaMA-Factory Web UI 导出和通过 MS-Swift CLI 导出两种方式。"
linkTitle: "导出微调模型"
weight: 6325
---

模型微调训练完成后，您需要将微调后的模型导出并推送到平台仓库，以便后续部署为推理服务或共享给团队使用。

平台支持以下两种导出方式：

## 方式一：通过 LLaMA-Factory 导出

如果使用 LLaMA-Factory 框架进行微调训练，可在 LlamaBoard Web UI 中直接导出模型。

### 操作步骤

1. 在 LlamaBoard 训练界面中，确认训练已完成。
2. 切换到**导出**（Export）页签。
3. 选择最优的训练检查点（Checkpoint）。
4. 设置导出路径和目标 CSGHub 模型 ID，格式为 `namespace/model-name`。
5. 点击**导出**按钮。

系统将自动执行以下操作：

- 将基础模型与 LoRA 权重进行合并
- 将合并后的完整模型推送到指定的 CSGHub 模型仓库

{{< notice tip >}}
如果目标模型仓库不存在，系统会自动创建新的模型仓库。建议使用有意义的命名，如 `your-namespace/qwen-medical-lora-v1`。
{{</ notice >}}

## 方式二：通过 MS-Swift CLI 导出

如果使用 MS-Swift 框架进行微调训练，可在 Notebook 终端中使用 CLI 命令导出模型。

### 操作步骤

1. 在 Notebook 终端中，确认训练已完成并记录模型输出路径。
2. 使用以下命令导出并推送模型：

```bash
swift export \
  --model output/v0-20250715-175923/checkpoint-93/ \
  --push_to_hub true \
  --hub_model_id username/new-model-name \
  --use_hf true
```

### 关键参数说明

| 参数 | 说明 |
|------|------|
| `--model` | 训练输出的检查点路径（例如 `output/v0-20250715-175923/checkpoint-93/`） |
| `--push_to_hub` | 设置为 `true`，将模型推送到远端仓库 |
| `--hub_model_id` | 目标模型 ID，格式为 `username/model-name` |
| `--use_hf` | 设置为 `true`，使用 Hugging Face 兼容格式推送 |

{{< notice warning >}}
MS-Swift 不支持覆盖已有的模型仓库。每次导出时必须使用一个新的模型 ID。如果指定的模型 ID 已存在，推送操作将失败。
{{</ notice >}}

## 导出后的操作

模型成功导出到平台仓库后，您可以：

- **部署为推理服务**：在模型详情页点击**模型部署**，创建专属推理实例
- **分享给团队**：将模型仓库设置为团队可见，便于协作使用
- **继续微调**：以导出的模型作为新的基础模型，进行进一步的微调训练
