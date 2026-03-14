---
title: "架构说明"
keywords: "Kube AI Hub, Kubernetes, 架构, API Server, GPU 调度器"
description: "Kube AI Hub 系统架构说明"
linkTitle: "架构说明"
weight: 1500
---

## 前后端分离

Kube AI Hub 采用前后端完全分离的设计，前端控制台通过标准 REST API 与后端服务通信，后端各功能组件可独立扩展，也可对接外部系统。可参考 [API 文档](../../reference/api-docs/)。

下图展示了系统整体架构：

![系统架构](/images/docs/v3.x/introduction/system-architecture-new-zh.svg)

## 前端

Kube AI Hub 控制台（Console）基于 React + MobX 构建，通过 Node.js 服务层将用户请求代理到后端 REST API。平台还内置了 Web 终端，用户可以在浏览器中直接使用 kubectl 命令行访问集群。

## 后端核心组件

| 组件 | 说明 |
|---|---|
| ks-apiserver | 集群管理的统一 API 接口，负责集群内部各模块通信与安全控制 |
| API Gateway | 认证鉴权、请求路由与代理，支持 LDAP/AD/SSO 集成 |
| ks-controller-manager | 实现平台业务逻辑，例如企业空间创建时同步权限配置 |
| GPU Scheduler | 异构 GPU 调度器，负责 vGPU 虚拟化切分与多卡并行调度策略 |

## Kubernetes 层

平台以标准 Kubernetes 为底座，不对 Kubernetes 本身做任何侵入性修改，所有扩展通过 CRD（Custom Resource Definitions）机制实现。主要利用以下 Kubernetes 能力：

- **Cluster API**：资源的增删改查与状态同步
- **调度器（Scheduler）**：Pod 调度策略（亲和性、污点容忍、GPU 资源请求）
- **工作负载引擎**：Deployment、StatefulSet、DaemonSet、Job、CronJob 的生命周期管理
- **RBAC**：角色与权限的细粒度控制

## 可插拔组件

以下组件均为可选，按需启用：

| 组件 | 功能 |
|---|---|
| Prometheus | 集群、节点与 GPU 的监控指标采集与告警 |
| Elasticsearch | 日志索引与全文检索 |
| Fluent Bit | 容器日志采集与转发 |
| Harbor | 容器镜像仓库，支持镜像扫描与权限管理 |
| OpenLDAP / AD | 企业用户身份认证与统一账号管理 |
| KubeEdge | 云边协同，将算力调度延伸至边缘节点 |

## 基础设施

Kube AI Hub 可运行在任何兼容的基础设施之上：

- **裸金属服务器**：适用于高性能 GPU 集群场景
- **虚拟机与私有云**：数据中心内部部署
- **公有云 Kubernetes**：阿里云、AWS、华为云、腾讯云等托管集群
- **混合云**：跨数据中心多集群统一管理

支持多种存储后端（S3、NFS、Ceph、LocalPV）和网络插件（Calico、Flannel）。
