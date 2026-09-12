---
title: "公共推理服务"
keywords: "Kube AI Hub, 公共推理服务, 公共模型, 云端 API"
description: "平台管理员如何管理本地公共推理部署与云端 API 通道。"
linkTitle: "公共推理服务"
weight: 3210
---

平台管理员可在 **管理员后台 → 算力资源管理 → 公共推理服务** 中维护两类公共模型：集群内的本地部署，以及转发到外部厂商的云端 API 通道。

完整操作说明（页签、通道字段、模型映射、连通性测试）见行业大模型平台文档：

- [管理公共推理服务](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_admin)
- [公共推理服务介绍](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_intro)
- [使用公共推理服务](/platform-model/docs/v1.x/inferencefinetune/inference/serverless_usage)

用户侧入口为 **模型推理 → 公共推理服务**。云端请求经控制台 `/aigateway` 转发，`model` 使用通道中登记的平台模型 ID。本地部署所选运行时框架的启动配置见 [运行时框架与镜像管理](./runtime-frameworks)。
