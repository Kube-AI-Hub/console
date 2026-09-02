---
title: "创建模型评测任务"
keywords: "行业大模型平台, 模型评测, OpenCompass, EvalScope, lm-evaluation-harness"
description: "介绍如何在行业大模型平台创建模型评测任务，使用标准基准测试评估模型性能。"
linkTitle: "创建模型评测任务"
weight: 6400
---

## 创建入口

在模型详情页，点击**模型评测**按钮，跳转至评测任务创建页面。

{{< notice note >}}
仅部分模型支持创建评测任务。如果所需模型没有"模型评测"选项，请联系平台管理员。
{{</ notice >}}

## 配置参数说明

进入模型评测任务创建页面后，填写以下配置信息，完成后点击**创建评测**：

| 参数 | 说明 |
|------|------|
| **任务名称** | 自定义评测任务名称 |
| **评测模型** | 平台中的模型标识，最多同时对比 3 个模型 |
| **评测描述** | 可选，说明本次评测目的 |
| **数据集** | **系统推荐数据集**：当前框架镜像内可用的基准集；**自选数据集**：平台中已有仓库。格式要求见[自定义评测数据集](./evaluation_with_custom_dataset) |
| **区域 / 资源配置** | 选择集群和算力规格 |
| **评测框架** | 先选框架（OpenCompass、EvalScope 或 lm-evaluation-harness），再选框架版本 |
| **评测框架参数 / vLLM 参数** | 所选版本声明了 engine_args 时出现。只影响运行，不改评分公式 |
| **高级选项** | 折叠项。Prompt 模版、打分插件默认来自所选数据集 + 框架，可不改。覆盖后分数不可与官方榜单直接比较 |

自定义参数的边界、何时该改、以及报告快照见[评测自定义参数](./evaluation_custom_params)。Prompt 与插件细节见[打分插件与 Prompt 模版](./evaluation_scoring_plugins)、[指标配置](./evaluation_metrics_config)。

## 查看评测结果

创建完成后，可通过顶部导航进入**模型训练评测 → 模型评测**查看所有评测任务的运行状态和评测结果；也可在**资源管理**页面中统一查看。

## 相关文档

- [评测框架介绍](./evaluation_framework_intro)
- [评测自定义参数](./evaluation_custom_params)
- [自定义评测数据集](./evaluation_with_custom_dataset)
- [打分插件与 Prompt 模版](./evaluation_scoring_plugins)
- [指标配置](./evaluation_metrics_config)
- [常见问题](./evaluation_faq)
