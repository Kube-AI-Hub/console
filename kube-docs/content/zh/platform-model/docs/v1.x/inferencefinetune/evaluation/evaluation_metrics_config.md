---
title: "指标配置"
keywords: "行业大模型平台, 模型评测, 打分插件, Accuracy, native_metric"
description: "打分插件与 OpenCompass、lm-evaluation-harness、EvalScope 原生指标对照，以及不可跨框架横比的约定。"
linkTitle: "指标配置"
weight: 6440
---

## 打分插件如何映射

打分插件是平台登记的评分器，运行时**映射**到当前已选框架的 metric / evaluator，而不是在控制面进程里算分。评测仍在 `spaces` 命名空间的 GPU/NPU Pod 中执行。

同一逻辑指标（例如 Accuracy）在三个框架各登记一条插件，`native_metric` 分别是该框架注册名。**同名 Accuracy 不可跨框架横比**。

| 插件 id | 框架 | 类型 | native_metric | 方向 |
|---------|------|------|---------------|------|
| `opencompass.accuracy` | OpenCompass | 规则 | `accuracy` | 高优 |
| `lm-evaluation-harness.acc` | lm-evaluation-harness | 规则 | `acc` | 高优 |
| `evalscope.acc` | EvalScope | 规则 | `acc` | 高优 |
| `*.exact_match` / `*.f1` | 对应框架 | 规则 | `exact_match` / `f1` | 高优 |
| `*.bleu` / `*.rouge` / `*.chrf` | 对应框架 | 表面重叠 | 框架注册名 | 高优 |
| `*.llm_judge` | 对应框架 | LLM 裁判 | `llm_judge` | 高优（**非客观真值**） |

聚合方式默认为 `mean`。报告里的 `metrics[]` 会带原始名、方向和聚合方式；**缺少的指标不会补 0**。

## engine_args 与指标的边界

- **engine_args / vLLM 参数**：batch size、最大生成长度、dtype 等推理设置，不改变评分公式。
- **打分插件**：决定用哪套框架原生指标。
- **Prompt 模版**：改变题干协议，分数不再与官方榜单可比。

不要用 Prompt 去「换指标」，也不要用 engine_args 去「改准确率定义」。

## 报告与发布门禁

详情页**评测报告** Tab 展示配置快照（模型/数据集 revision、框架、Prompt、插件、engine_args）、样本覆盖率和失败样例入口。任务运行中也可以打开详情查看配置和状态。

`report_id` 与评测 `task_id` 相同，是不可变的报告身份。后续发布门禁应绑定该 id，而不是改历史模版后重算同一任务。

LLM Judge 分数写入报告的 `judge` 字段（裁判模型、rubric、解析成功率），不能当作客观真值，也不能作为唯一发布门禁。

## 相关文档

- [打分插件与 Prompt 模版](./evaluation_scoring_plugins)
- [创建模型评测任务](./evaluation_create)
- [评测框架介绍](./evaluation_framework_intro)
