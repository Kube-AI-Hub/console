---
title: "Heterogeneous Compute Management"
layout: "scenario"

css: "scss/scenario.scss"

section1:
  title: "AI Compute Management Platform: Simplify Complexity, 3–10x Better Utilization"
  content: Through GPU/CPU heterogeneous compute pooling and virtualization, resource utilization can be improved by 3–10x. Unified scheduling and management of AI clusters enables platform-level management of hardware through resource pooling and GPU virtualization.
  content2: Fully compatible with domestic GPU/CPU/NPU hardware, building a secure and controllable local compute infrastructure.
  inCenter: true

image: /images/docs/v3.x/introduction/use-cases/ai-compute-architecture.svg

section2:
  title: Four Core Values to Fully Unleash AI Compute Potential
  list:
    - title: Compute Pooling for Maximum Utilization
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-architecture.svg
      summary: GPU/CPU heterogeneous compute pooling and virtualization improves utilization by 3–10x.
      contentList:
        - content: <span>Heterogeneous GPU virtualization</span> supporting NVIDIA, Cambricon, Huawei Ascend, Iluvatar, and more
        - content: <span>Unified compute resource pooling</span> to manage GPU clusters, CPU clusters, and file storage
        - content: <span>Native Kubernetes integration</span> for seamless compute resource and service management
        - content: <span>Harbor image registry integration</span> with out-of-the-box Helm Charts application management

    - title: On-Demand Allocation and Flexible Scheduling
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-platform-value.svg
      summary: Supports compute over-provisioning and fine-grained slicing, with flexible allocation by tenant/department/project and elastic scaling on demand.
      contentList:
        - content: <span>Multi-tenant isolation</span> with standard authentication, custom authentication, and multi-tenant permission management
        - content: <span>Fine-grained compute slicing</span> with GPU scheduling at sub-card granularity
        - content: <span>Elastic scaling</span> to dynamically adjust compute resources based on workload demands
        - content: <span>Comprehensive cluster management</span> covering nodes, groups, containers, storage, monitoring, and logging

    - title: Metering, Billing, and Fine-grained Cost Management
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-architecture.svg
      summary: Supports compute usage monitoring and cost accounting to help enterprises manage IT costs with precision.
      contentList:
        - content: <span>Real-time compute usage monitoring</span> for accurate tracking of GPU/CPU resource consumption
        - content: <span>Multi-dimensional billing</span> with flexible statistics by tenant, project, and time period
        - content: <span>Cost visualization</span> for intuitive display of compute usage and cost allocation across departments

    - title: Intelligent Scheduling and Operations
      image: /images/docs/v3.x/introduction/use-cases/ai-compute-platform-value.svg
      summary: Thousand-card level distributed scheduling capability with built-in job queues, service deployment, monitoring alerts, and log management.
      contentList:
        - content: <span>Thousand-card distributed scheduling</span> supporting large-scale parallel AI training jobs
        - content: <span>Built-in job queues</span> with priority scheduling and resource reservation policies
        - content: <span>Monitoring and alerting</span> for real-time cluster health awareness and automatic fault notification
        - content: <span>Log management</span> for unified collection and retrieval of container logs to quickly locate issues

section3:
  title: "Product Architecture: Full-Stack Management from User Permissions to Heterogeneous Hardware"
  image: /images/docs/v3.x/introduction/platform-overview.svg
  content: Get started quickly with the AI Compute Management Platform by reading the documentation.
  btnContent: View Documentation
  link: docs/v3.4/introduction/what-is-kube-ai-hub/
  bgLeft: /images/service-mesh/3-2.svg
  bgRight: /images/service-mesh/3.svg
---
