---
title: "打分插件与 Prompt 模版"
keywords: "行业大模型平台, 模型评测, 打分插件, Prompt 模版, 高级选项"
description: "介绍模型评测创建页高级选项：Prompt 模版与打分插件如何随框架和数据集加载默认值，以及何时应该覆盖。"
linkTitle: "打分插件与 Prompt 模版"
weight: 6435
---

## 高级选项放在哪里

创建评测任务时，主流程不变：先选模型、数据集、集群资源，再选**评测框架**和框架版本，以及已有的评测框架参数 / vLLM 参数。三类自定义参数的边界见[评测自定义参数](./evaluation_custom_params)。

**Prompt 模版**和**打分插件**收在折叠的**高级选项**中，默认不展开。不改则任务与原先一致：使用当前框架 + 数据集自带的官方协议。

打开高级选项后，平台会按**已选框架 + 数据集**填入默认值：

- `default_prompt_template_id`
- `default_scoring_plugin_ids`

来源是系统推荐目录。切换框架或数据集时会重新加载默认值，覆盖尚未提交的手工改动，避免把上一套框架的插件留在表单里。

打分插件必须带 `framework`（`opencompass` / `lm-evaluation-harness` / `evalscope`），与当前评测框架一一对应，不能跨框架混用。

高级选项旁注明：覆盖后分数不可与官方榜单直接比较，所选模版和插件会写入评测报告快照。

## 自定义数据集没有默认值时

自选数据集不在推荐目录中，高级选项保持为空。语义仍是「框架对该文件布局的默认协议」。你可以再选手动兼容的 Prompt 模版和打分插件。

## 什么情况下需要改 Prompt

评测 Prompt 是协议的一部分，不是「把模型问得更聪明」。官方推荐集（MMLU、C-Eval、GSM8K 等）默认**不要改**：分数只有和论文/榜单同一套 `doc_to_text` / few-shot / chat template 才可横比。改了 Prompt，分数只能当「本任务自定义协议」看。

**需要改（高级选项才有意义）**

- **自定义业务集**：自有 csv/jsonl 没有框架内置模版，必须指定题干怎么拼。
- **对齐线上系统提示**：要测客服 / 法规助手等真实 system prompt。
- **基座 vs 对话模型**：completion 模版 vs chat 模版。
- **协议消融**：同一数据集上 zero-shot vs 指定 few-shot 文案、中英题干、是否带「让我们一步步思考」。
- **安全 / 拒答 / 红队**：需要固定攻击前缀或政策话术。
- **LLM Judge**：裁判用的 rubric 与待测模型作答 Prompt 分开配置。

**不该改**

- 用系统推荐集做「和别人比 Accuracy / 复现论文」：保持框架默认。
- 只想换指标：用打分插件，不要动 Prompt。
- 只想改 batch / 最大生成长度：用已有 engine_args。

OpenCompass **官方集**的 Prompt 大多写死在镜像 config 中，P0 不承诺任意官方集 + 任意模版。lm-evaluation-harness 自定义数据集的 `task.yaml` 可按所选模版覆盖 `doc_to_text`，并按打分插件覆盖 `metric_list`。

## 相关文档

- [评测自定义参数](./evaluation_custom_params)
- [指标配置](./evaluation_metrics_config)
- [创建模型评测任务](./evaluation_create)
- [评测框架介绍](./evaluation_framework_intro)
- [自定义评测数据集](./evaluation_with_custom_dataset)
