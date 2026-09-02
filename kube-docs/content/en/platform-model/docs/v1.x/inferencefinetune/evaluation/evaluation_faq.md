---
title: "Model Evaluation FAQ"
keywords: "Industry AI Model Platform, model evaluation, FAQ"
description: "Frequently asked questions about model evaluation."
linkTitle: "Model Evaluation FAQ"
weight: 6410
---

## FAQ

### The evaluation button is grayed out with message "Framework does not support this model"

**Cause**: The current evaluation framework does not yet support this model.

**Solution**: Contact the platform administrator with the model name and relevant details. The administrator will evaluate and add support as soon as possible.

---

### Evaluation task is stuck in "Pending" state for a long time

**Cause**: Shared resources are selected and the public compute queue is busy.

**Solution**:
1. Wait for the queue to clear (shared resource evaluation tasks execute in submission order).
2. If immediate execution is needed, switch to **Dedicated Resources** (billed by time).

---

### Evaluation results appear abnormally low

**Possible Causes**:
- The selected evaluation dataset does not match the model's training language (e.g., using a Chinese dataset to evaluate an English model).
- The model lacks instruction-following capability for the corresponding task (base model vs. instruction-tuned model).
- Evaluation framework parameters are not configured appropriately.

**Solution**:
1. Choose evaluation datasets that match the model's language and task type.
2. For base models, use evaluation methods suitable for pre-trained models (e.g., perplexity evaluation).
3. Refer to [Evaluation Framework Overview](./evaluation_framework_intro) to understand each framework's applicable scenarios.

---

### How to use a custom dataset for evaluation

Refer to the [Custom Evaluation Datasets](./evaluation_with_custom_dataset) documentation for detailed steps.

---

### Why is the system-recommended dataset list empty offline?

**Cause**: System recommendations previously listed only dataset repositories that already existed and had `runtime_framework` plus `evaluation` tags. Built-in OpenCompass / lm-evaluation-harness data is baked into the evaluation images and is not imported during install, so the dropdown is empty without internet or multi-source sync.

**Current behavior**:
1. When you choose **OpenCompass** or **lm-evaluation-harness**, the new evaluation page lists datasets that are actually baked into the image. The repository does not need to exist first.
2. After a successful evaluation, any built-in datasets used in that job and still missing on the platform are created as public dataset repositories, with files committed and `evaluation` plus `runtime_framework` tags applied, so they appear on the dataset detail page.
3. **EvalScope** has no equivalent built-in package; continue to sync datasets or use a custom dataset.

Custom datasets are not imported after evaluation.

---

### Should I change Prompt / scoring plugins in Advanced options?

Keep the framework protocol on official recommended sets so scores stay comparable with papers and leaderboards. Change them for custom business sets, production system prompts, protocol ablations, or LLM Judge. See [Scoring Plugins and Prompt Templates](./evaluation_scoring_plugins) and [Metrics Configuration](./evaluation_metrics_config).

Accuracy with the same name is not comparable across OpenCompass, lm-evaluation-harness, and EvalScope.

---

### Can I open details while an evaluation is still running?

Yes. The detail page at least shows the configuration snapshot and status. Scores, coverage, and failure samples are written into the report after the task succeeds.

## Related documentation

- [Scoring Plugins and Prompt Templates](./evaluation_scoring_plugins)
- [Metrics Configuration](./evaluation_metrics_config)
- [Custom Evaluation Datasets](./evaluation_with_custom_dataset)
