---
title: "运行时框架与镜像管理"
keywords: "Kube AI Hub, 运行时框架, 推理引擎, 启动配置, KServe, llm-d"
description: "平台管理员如何配置推理引擎镜像、引擎参数与启动配置（KServe / llm-d）。"
linkTitle: "运行时框架与镜像管理"
weight: 3220
---

平台管理员可在 **管理员后台 → 算力资源管理 → 运行时框架与镜像管理** 中维护推理引擎、微调、评测、Notebook 和任务镜像。列表可按计算类型、状态筛选。开启 KServe 后，推理进程的命令来自 **启动配置（KServe / llm-d）**（`decode` / `prefill` / `routing`），引擎参数中的 `${GPU_NUM}` 会按规格每副本卡数展开。

完整操作说明（页签、导入内置框架、引擎参数、启动配置与编排后端）见行业大模型平台文档：

- [配置推理引擎](/platform-model/docs/v1.x/inferencefinetune/inference/runtime_framework_admin)
- [创建推理实例](/platform-model/docs/v1.x/inferencefinetune/inference/endpoint_create)
- [管理公共推理服务](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_admin)
