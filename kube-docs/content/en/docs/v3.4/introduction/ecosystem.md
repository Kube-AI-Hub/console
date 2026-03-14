---
title: "Kube AI Hub Ecosystem Tools"
keywords: "Kubernetes, Kube AI Hub, ecosystem, GPU, monitoring, storage"
description: "Kube AI Hub ecosystem tools"
linkTitle: "Kube AI Hub Ecosystem Tools"
weight: 1200
---

## Abundant Ecosystem Tools

Kube AI Hub integrates **a wide breadth of major cloud-native open-source tools**, supporting seamless integration with popular third-party components across GPU scheduling, image registry, log collection, monitoring and alerting, storage, networking, and identity. These open-source projects serve as optional backend components, interacting with the console through standard APIs to provide a consistent experience — reducing operational complexity.

All components are loosely coupled with the platform: **enable only what you need, all are pluggable**.

![Kube AI Hub Ecosystem](/images/docs/v3.x/introduction/ecosystem.svg)

## Component Overview

| Category | Component | Description |
|---|---|---|
| GPU & Scheduling | NVIDIA DCGM | GPU metric collection (utilization, VRAM, temperature, power) |
| GPU & Scheduling | vGPU Scheduler | Fine-grained GPU slicing and virtualized scheduling |
| GPU & Scheduling | Volcano / Koordinator | Batch job queues and distributed scheduling frameworks |
| Monitoring | Prometheus | Cluster and node metric collection and storage |
| Monitoring | AlertManager | Alert routing and silence policies |
| Monitoring | metrics-server | Kubernetes native resource metrics service |
| Logging | Fluent Bit | Container log collection and forwarding |
| Logging | Elasticsearch | Log indexing, storage, and full-text search |
| Logging | Kafka | High-throughput log message queue |
| Registry | Harbor | Enterprise container image registry with vulnerability scanning |
| App Management | Helm / OpenPitrix | Application templates and lifecycle management |
| Identity | OpenLDAP / AD | Enterprise user directory and unified account management |
| Identity | OAuth2 / SSO | Third-party identity provider and single sign-on |
| Notifications | Email / DingTalk | Alert notification channels |
| Notifications | WeCom / Slack | Instant message notification channels |
| Storage | Ceph RBD / CSI | Enterprise-grade distributed block storage |
| Storage | NFS / GlusterFS | Shared file storage |
| Storage | LocalPV / S3 | Local storage and object storage |
| Network | Calico / Flannel | Container network plugins (CNI) |
| Network | OpenELB | Load balancer for bare metal Kubernetes |
| Network | KubeEdge | Cloud-edge collaboration, extending compute to edge nodes |
