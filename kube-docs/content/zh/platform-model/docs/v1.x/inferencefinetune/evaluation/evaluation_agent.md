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
| **评测集** | 至少一项，可搜索或自行输入 |
| **评测框架** | `claw-eval` 或名称以 `claw-eval-` 开头的其它智能体框架 |
| **打分方式** | 仅基础框架 `claw-eval` 需要选择。**裁判模型** 与 **代码规则** 二选一 |
| **区域 / 算力项目 / 规格** | 与模型评测相同的算力申请 |

![创建页会带上从工坊点进来的智能体，框架默认 claw-eval](/images/docs/platform-model/evaluation/agent-create.png)

选择 **裁判模型** 时可以改裁判模型名，并填写裁判 Prompt。Prompt 留空则用框架默认提示。

![基础框架的裁判模型打分](/images/docs/platform-model/evaluation/agent-scoring-judge.png)

选择 **代码规则** 后，裁判模型输入消失，改为填写评分代码。

![基础框架的代码规则打分](/images/docs/platform-model/evaluation/agent-scoring-code.png)

`claw-eval-codex` 使用框架自带流程，页面不提供这两种打分。

## 查看结果

创建后回到 **智能体评测** 列表。表里的第二列是智能体，而不是模型。任务状态、下载和详情与模型评测相同。

![智能体评测列表，第二列是智能体](/images/docs/platform-model/evaluation/agent-list.png)

模型评测列表不显示这些任务。

## 相关文档

- [创建模型评测任务](./evaluation_create)
- [智能体工坊](../../workshop/)
