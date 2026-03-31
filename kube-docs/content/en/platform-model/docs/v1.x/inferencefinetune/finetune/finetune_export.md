---
title: "Export Fine-tuned Models"
keywords: "Industry AI Model Platform, export fine-tuned model, LoRA merge, LLaMA-Factory, MS-Swift, model push"
description: "How to export fine-tuned models on the Industry AI Model Platform using LLaMA-Factory Web UI or MS-Swift CLI."
linkTitle: "Export Fine-tuned Models"
weight: 6325
---

After model fine-tuning is complete, you need to export the fine-tuned model and push it to the platform repository for subsequent deployment as an inference service or sharing with your team.

The platform supports two export methods:

## Method A: Export via LLaMA-Factory

If you used the LLaMA-Factory framework for fine-tuning, you can export the model directly from the LlamaBoard Web UI.

### Steps

1. In the LlamaBoard training interface, confirm that training is complete.
2. Switch to the **Export** tab.
3. Select the best training checkpoint.
4. Set the export path and target CSGHub model ID in the format `namespace/model-name`.
5. Click the **Export** button.

The system will automatically:

- Merge the base model with the LoRA weights
- Push the merged full model to the specified CSGHub model repository

{{< notice tip >}}
If the target model repository does not exist, the system will automatically create a new one. Use meaningful names such as `your-namespace/qwen-medical-lora-v1`.
{{</ notice >}}

## Method B: Export via MS-Swift CLI

If you used the MS-Swift framework for fine-tuning, you can export the model using CLI commands in the Notebook terminal.

### Steps

1. In the Notebook terminal, confirm that training is complete and note the model output path.
2. Use the following command to export and push the model:

```bash
swift export \
  --model output/v0-20250715-175923/checkpoint-93/ \
  --push_to_hub true \
  --hub_model_id username/new-model-name \
  --use_hf true
```

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `--model` | Path to the training output checkpoint (e.g., `output/v0-20250715-175923/checkpoint-93/`) |
| `--push_to_hub` | Set to `true` to push the model to the remote repository |
| `--hub_model_id` | Target model ID in `username/model-name` format |
| `--use_hf` | Set to `true` to push in Hugging Face-compatible format |

{{< notice warning >}}
MS-Swift does not support overwriting existing model repositories. You must use a new model ID for each export. If the specified model ID already exists, the push operation will fail.
{{</ notice >}}

## Post-Export Actions

After the model is successfully exported to the platform repository, you can:

- **Deploy as an inference service**: Click **Model Deployment** on the model details page to create a dedicated inference instance
- **Share with your team**: Set the model repository visibility to team-accessible for collaboration
- **Continue fine-tuning**: Use the exported model as a new base model for further fine-tuning
