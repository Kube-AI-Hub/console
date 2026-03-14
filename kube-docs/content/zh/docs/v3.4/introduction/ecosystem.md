---
title: "Kube AI Hub 生态工具"
keywords: "Kubernetes, Kube AI Hub, 生态工具, GPU, 监控, 存储"
description: "Kube AI Hub 生态工具"
linkTitle: "Kube AI Hub 生态工具"
weight: 1200
---

## 丰富的生态工具

Kube AI Hub **围绕 Kubernetes 集成了多个云原生生态主流的开源软件**，同时支持对接大部分流行的第三方组件，涵盖 GPU 调度、镜像仓库、日志收集、监控告警、存储、网络、认证等方向。这些开源项目作为后端组件，通过标准 API 与控制台交互，在统一界面提供一致的用户体验，降低学习成本。

所有功能模块与平台松耦合，**按需启用，可插拔安装**。

![Kube AI Hub 生态系统](/images/docs/v3.x/introduction/ecosystem-zh.svg)

## 集成组件一览

| 类别 | 组件 | 说明 |
|---|---|---|
| GPU 与调度 | NVIDIA DCGM | GPU 指标采集（利用率、显存、温度、功耗）|
| GPU 与调度 | vGPU Scheduler | GPU 细粒度切分与虚拟化调度 |
| GPU 与调度 | Volcano / Koordinator | 批量任务队列与分布式调度框架 |
| 监控 | Prometheus | 集群与节点指标采集与存储 |
| 监控 | AlertManager | 告警路由与静默策略 |
| 监控 | metrics-server | Kubernetes 原生资源指标服务 |
| 日志 | Fluent Bit | 容器日志采集与转发 |
| 日志 | Elasticsearch | 日志索引、存储与全文检索 |
| 日志 | Kafka | 高吞吐日志消息队列 |
| 镜像仓库 | Harbor | 企业级容器镜像仓库，支持漏洞扫描 |
| 应用管理 | Helm / OpenPitrix | 应用模板与生命周期管理 |
| 身份认证 | OpenLDAP / AD | 企业用户目录与统一账号管理 |
| 身份认证 | OAuth2 / SSO | 第三方身份提供商与单点登录 |
| 通知 | Email / 钉钉 | 告警通知渠道 |
| 通知 | 企业微信 / Slack | 即时消息通知渠道 |
| 存储 | Ceph RBD / CSI | 企业级分布式块存储 |
| 存储 | NFS / GlusterFS | 共享文件存储 |
| 存储 | LocalPV / S3 | 本地存储与对象存储 |
| 网络 | Calico / Flannel | 容器网络插件（CNI） |
| 网络 | OpenELB | 裸金属 Kubernetes 负载均衡器 |
| 网络 | KubeEdge | 云边协同，算力延伸至边缘节点 |
