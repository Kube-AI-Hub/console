---
title: "帐户管理和权限控制"
description: "帐户管理和权限控制"
layout: "second"

linkTitle: "帐户管理和权限控制"
weight: 12000

icon: "/images/docs/v3.x/docs.svg"

---

Kube AI Hub 的多租户架构是运行在容器平台上的许多关键组件的基础。最小租户单元是控制台里的 **租户(企业空间)**，行业大模型平台共用同一套租户（默认公共租户 `public`）。本章概述多租户系统，并演示如何为第三方登录配置身份验证。模型广场侧说明见 [租户与算力归属](/platform-model/docs/v1.x/tenancy/)。