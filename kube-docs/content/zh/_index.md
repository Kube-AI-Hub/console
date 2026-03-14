---
title: 异构算力管理平台，支持 GPU/CPU 多集群统一调度 | Kube AI Hub
description: Kube AI Hub 是以 Kubernetes 为内核的异构算力管理平台，提供 GPU/CPU 资源池化、vGPU 虚拟化、多租户隔离、智能调度与全栈可观测性，帮助企业将算力利用率提升 3～10 倍。

css: scss/index.scss

section1:
  title: Kube AI Hub 算力管理平台
  topic: 异构算力统一管理<br>算力利用率提升 3～10 倍
  content: Kube AI Hub 是以 Kubernetes 为内核的异构算力管理平台，通过 GPU/CPU 资源池化与 vGPU 虚拟化技术，实现硬件集群平台化管理。支持国产 GPU/CPU/NPU，构建安全可控的本地算力底座。

section2:
  title: 全栈算力管理平台，化繁为简
  content: Kube AI Hub 提供从硬件资源到业务应用的全链路算力管理能力，通过统一控制台纳管异构 GPU/CPU 集群，内置多租户隔离、弹性调度与精细化计量，帮助企业快速构建自主可控的 AI 算力基础设施。
  children:
    - name: 快速部署
      icon: /images/home/easy-to-run.svg
      content: 支持部署在任意 Kubernetes 集群或裸金属环境，提供在线与离线安装，一键扩容与升级

    - name: 功能完整
      icon: /images/home/feature-rich.svg
      content: 在统一平台中纳管 GPU 节点、任务队列、算力调度、多租户、监控告警、计量计费与日志管理

    - name: 模块化 & 可插拔
      icon: /images/home/modular-pluggable.svg
      content: 所有功能模块均可按需开启，松耦合架构支持灵活集成第三方调度器与存储系统

section3:
  title: 不同团队的核心价值
  content: 平台内置多租户设计，让基础设施团队、算法工程师、运维人员在同一平台中协同工作。基础设施团队统一管控硬件资源，算法工程师专注业务开发，运维团队获得完整的可观测性与自动化运维能力。
  children:
    - name: 基础设施团队
      content: 统一纳管异构 GPU/CPU 集群，资源池化降低硬件成本
      icon: /images/home/7.svg
      children:
        - content: 支持英伟达、华为昇腾、寒武纪、天数智芯等主流 GPU 统一接入
        - content: vGPU 虚拟化切分算力资源，硬件利用率提升 3～10 倍
        - content: 内置 CSI 对接主流存储，支持 S3、NFS 等文件存储资源
        - content: 多集群统一管理，支持跨数据中心与混合云部署

    - name: 算法工程师
      content: 专注 AI 训练与推理业务，告别繁琐的基础设施配置
      icon: /images/home/74.png
      children:
        - content: 通过 Web 控制台提交 AI 训练任务，无需编写复杂的 Kubernetes YAML
        - content: 内置任务队列支持优先级调度与资源预留，合理分配训练算力
        - content: 支持 PyTorch、TensorFlow 等主流框架的分布式训练任务
        - content: 一键部署推理服务，支持自动弹性扩缩容

    - name: 运维团队
      content: 构建一站式的算力平台运维与可观测体系
      icon: /images/home/71.svg
      children:
        - content: 多维度监控与告警：GPU 温度、利用率、显存使用率实时告警
        - content: 统一日志收集与检索，快速定位任务失败原因
        - content: 节点健康检查与自动故障隔离，保障训练任务稳定性
        - content: 提供图形化操作界面与 Web 终端，满足不同运维习惯

    - name: 业务负责人
      content: 算力成本透明可见，按需分配，精细化管理 IT 预算
      icon: /images/home/80.svg
      children:
        - content: 按租户、部门、项目维度查看算力用量与费用分摊报表
        - content: 支持算力配额管理，避免资源抢占与浪费
        - content: 计量计费报告辅助 IT 预算规划与成本核算
        - content: 多租户隔离确保不同团队的数据与资源安全

section4:
  title: 核心功能特性
  content: Kube AI Hub 覆盖从硬件接入到业务交付的完整算力管理链路，所有功能均可按需启用。
  children:
    - name: 异构 GPU 集群管理
      icon: /images/home/provisioning-kubernetes.svg
      content: 统一接入英伟达、华为昇腾、寒武纪、天数等异构 GPU，支持在线扩容节点与跨集群资源调配

    - name: vGPU 虚拟化调度
      icon: /images/home/k-8-s-resource-management.svg
      content: GPU 细粒度切分与共享，支持多任务并发使用同一 GPU，显著提升硬件利用率

    - name: 多租户权限管理
      icon: /images/home/multi-tenant-management.svg
      content: 提供平台、企业空间、项目三层权限体系，支持 AD/LDAP 集成，保障多团队资源安全隔离

    - name: 存储与网络
      icon: /images/home/multi-tenant-management.svg
      content: 支持 S3、NFS、Ceph、LocalPV 等多种存储方案，内置网络策略管理，支持 Calico、Flannel 等主流 CNI

  features:
    - name: 异构算力管理
      icon: /images/home/dev-ops.svg
      content: GPU/CPU 异构算力池化与虚拟化，利用率提升 3～10 倍，支持国产 GPU/CPU/NPU，构建安全可控本地算力底座
      link: "ai-compute/"
      color: orange

    - name: 智能任务调度
      icon: /images/home/service.svg
      content: 千卡级分布式调度能力，内置优先级任务队列与资源预留策略，支持大规模 AI 训练任务并行执行
      link: "/docs/v3.4/pluggable-components/devops/"
      color: red

    - name: 全栈可观测性
      icon: /images/home/rich.svg
      content: 多维度 GPU/CPU 监控、告警与日志管理，多租户隔离，支持多种告警通知渠道
      link: "/docs/v3.4/pluggable-components/logging/"
      color: green

    - name: 计量与计费
      icon: /images/home/store.svg
      content: 算力用量监控与计费核算，按租户/部门/项目多维度统计，帮助企业精细化管理 IT 成本
      link: "/docs/v3.4/toolbox/metering-and-billing/view-resource-consumption/"
      color: grape

    - name: 多集群管理
      icon: /images/home/management.svg
      content: 跨数据中心与混合云统一管理多个 GPU/CPU 集群，提供集群高可用与灾备最佳实践
      link: "/docs/v3.4/multicluster-management/introduction/overview/"
      color: orange

    - name: 边缘节点支持
      icon: /images/home/network.svg
      content: 基于 KubeEdge 将算力调度延伸至边缘节点，支持云边协同的 AI 推理任务分发与管理
      link: "/docs/v3.4/pluggable-components/kubeedge/"
      color: green

    - name: 应用市场
      icon: /images/home/multiple.svg
      content: 内置基于 Helm 的应用市场与镜像仓库（Harbor），支持 AI 框架与工具的一键部署与生命周期管理
      link: "/docs/v3.4/pluggable-components/app-store/"
      color: grape

section5:
  title: 前后端分离的云原生平台架构
  frontEnd:
    title: 前端
    project: Kube AI Hub Console
    children:
      - icon: /images/home/mobx.jpg
      - icon: /images/home/koa.jpg
      - icon: /images/home/react.png

  backEnd:
    title: 后端 (REST API)
    project: Kube AI Hub System
    group:
      - name: API Server
      - name: API Gateway
      - name: Controller Manager
      - name: GPU Scheduler

---
