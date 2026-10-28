---
title: "智能体评测"
keywords: "行业大模型平台, 智能体评测, claw-eval, 智能体工坊"
description: "介绍如何对已发布的智能体发起评测：选择智能体、评测集和评测框架，并用裁判模型或代码规则打分。"
linkTitle: "智能体评测"
weight: 6450
---

智能体评测放在 **模型训练评测** 里，和模型评测并列。它评的是智能体工坊里已经发布的智能体，任务仍由平台的评测作业执行。

## 入口

打开顶部 **训练评测**，在 **模型评测** 旁边进入 **智能体评测**。

![训练评测菜单中，智能体评测在模型评测旁边](/images/docs/platform-model/evaluation/agent-menu.png)

智能体工坊的卡片，以及数字分身、服务专家的构建页，也有 **评测**。已发布的智能体会直接打开创建页并带上这个智能体；草稿需要先发布。

![智能体卡片上的评测入口](/images/docs/platform-model/evaluation/workshop-entry.png)

## 创建任务

在智能体评测列表点击 **新建评测**，填写：

| 参数 | 说明 |
|------|------|
| **任务名称** | 这次评测的名称 |
| **智能体** | 当前租户里已发布、并且有服务地址的智能体。工坊跳转过来时会预先选中 |
| **服务令牌** | 发布智能体时复制的令牌，评测作业用它调用该智能体 |
| **评测集** | 至少一项，可搜索或自行输入。每条样本生成一个评测任务 |
| **评测框架** | `claw-eval` 或名称以 `claw-eval-` 开头的其它智能体框架 |
| **打分方式** | 仅基础框架 `claw-eval` 需要选择。**裁判模型** 与 **代码规则** 二选一 |
| **区域 / 算力项目 / 规格** | 与模型评测相同的算力申请 |

![创建页会带上从工坊点进来的智能体，框架默认 claw-eval](/images/docs/platform-model/evaluation/agent-create.png)

## 评测集格式

评测集里的样本就是这次评测的题目，**一条样本一个任务**。样本文件用 JSONL，每行一个对象：

```json
{"query": "3 + 5 等于几？只回答数字。", "reference": "8"}
{"query": "用一句话总结：会议改到周五下午三点。", "reference": "会议改到周五下午三点"}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `query` | 是 | 发给智能体的问题 |
| `reference` | 否 | 参考答案，裁判留空 Prompt 时按它打分 |
| `rubric` | 否 | 这条样本专属的评分标准，覆盖页面上的裁判 Prompt |

没有可用样本时任务会直接失败，不会退回框架自带的固定套件。评测集里已经放了 claw-eval 的 `task.yaml` 时，按原生任务运行。

选择 **裁判模型** 时可以改裁判模型名，并填写裁判 Prompt。Prompt 留空则按参考答案打分。

![基础框架的裁判模型打分](/images/docs/platform-model/evaluation/agent-scoring-judge.png)

选择 **代码规则** 后，裁判模型输入消失，改为填写评分代码。代码里定义 `score(output, sample)`，返回 0–1 的分数：

```python
def score(output, sample):
    return 1.0 if sample.get("reference") in output else 0.0
```

代码抛异常或没有 `score` 函数时，任务记为执行异常，不会静默记 0 分。

![基础框架的代码规则打分](/images/docs/platform-model/evaluation/agent-scoring-code.png)

`claw-eval-codex` 使用框架自带流程，页面不提供这两种打分，也不会读取这里选的评测集。

## 查看结果

创建后回到 **智能体评测** 列表。表里的第二列是智能体，而不是模型。任务状态、下载和详情与模型评测相同。

![智能体评测列表，第二列是智能体](/images/docs/platform-model/evaluation/agent-list.png)

任务成功后，详情页的 **评测报告** 顶部是智能体评测结果卡：任务数、平均分、通过数、执行异常与 Token 总量。通过线是 0.75，每条样本默认跑 3 次取平均；逐条明细在页头的下载里。

![智能体评测详情页的结果卡](/images/docs/platform-model/evaluation/agent-result.png)

模型评测列表不显示这些任务。

## 相关文档

- [创建模型评测任务](./evaluation_create)
- [智能体工坊](../../workshop/)
