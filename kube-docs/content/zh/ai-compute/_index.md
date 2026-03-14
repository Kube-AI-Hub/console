---
title: "异构算力管理"
layout: "scenario"

css: "scss/scenario.scss"

section1:
  title: 异构算力管理平台：化繁为简，提升 3～10 倍算力利用率
  content: 通过 GPU/CPU 异构算力池化与虚拟化，利用率可提升 3～10 倍。统一调度与管理智算集群，通过资源池化、GPU 虚拟化技术，实现硬件集群平台化管理。
  content2: 全面信创适配，支持国产 GPU/CPU/NPU，构建安全可控本地算力底座。
  inCenter: true

image: /images/docs/v3.x/introduction/use-cases/ai-compute-architecture-zh.svg

section2:
  title: 四大核心价值，全面释放 AI 算力潜能
  list:
    - title: 算力池化，极致利用率
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-architecture-zh.svg
      summary: 通过 GPU/CPU 异构算力池化与虚拟化，利用率可提升 3～10 倍。
      contentList:
        - content: <span>异构 GPU 算力虚拟化，</span>支持英伟达、寒武纪、华为昇腾、天数等主流 GPU
        - content: <span>算力资源池化管理，</span>统一调度 GPU 集群、CPU 集群与文件存储资源
        - content: <span>Kubernetes 原生集成，</span>算力资源管理与服务管理无缝对接
        - content: <span>镜像仓库（Harbor）集成，</span>应用管理（Helm Charts）开箱即用

    - title: 按需分配，灵活调度
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-platform-value-zh.svg
      summary: 支持算力超分与精细切分，按租户/部门/项目灵活分配，按需弹性伸缩。
      contentList:
        - content: <span>多租户隔离，</span>标准认证、自定义认证与多租户权限管理
        - content: <span>精细切分算力，</span>GPU 算力调度支持细粒度资源分片
        - content: <span>弹性伸缩，</span>根据业务负载动态调整算力资源
        - content: <span>节点、组、容器、存储、监控、日志</span>全方位集群管理

    - title: 计量计费，精细管理
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-architecture-zh.svg
      summary: 支持算力用量监控与计费核算，帮助企业精细化管理 IT 成本。
      contentList:
        - content: <span>实时算力用量监控，</span>精准追踪 GPU/CPU 资源消耗
        - content: <span>多维度计费核算，</span>按租户、项目、时间段灵活统计
        - content: <span>成本可视化，</span>直观呈现各部门算力使用与费用分摊

    - title: 智能调度与运维
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-platform-value-zh.svg
      summary: 具备千卡级别分布式调度能力，内置任务队列、服务部署、监控告警与日志管理。
      contentList:
        - content: <span>千卡级分布式调度，</span>支持大规模 AI 训练任务并行执行
        - content: <span>内置任务队列，</span>优先级调度与资源预留策略
        - content: <span>监控告警，</span>实时感知集群健康状态，故障自动通知
        - content: <span>日志管理，</span>统一收集与检索容器日志，快速定位问题

section3:
  title: 产品架构：从用户权限到异构硬件的全栈管理平台
  image: /images/docs/v3.x/introduction/platform-overview-zh.svg
  content: 立即查阅文档，快速上手异构算力管理平台
  btnContent: 查看文档
  link: docs/v3.4/introduction/what-is-kube-ai-hub/
  bgLeft: /images/service-mesh/3-2.svg
  bgRight: /images/service-mesh/3.svg
---
