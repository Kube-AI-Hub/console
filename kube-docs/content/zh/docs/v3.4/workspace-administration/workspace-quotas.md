---
title: "租户(企业空间)配额"
keywords: 'Kube AI Hub, Kubernetes, 租户(企业空间), 配额'
description: '设置租户(企业空间)配额以管理租户(企业空间)中所有项目和 DevOps 项目的总资源用量。'
linkTitle: "租户(企业空间)配额"
weight: 9700
---

租户(企业空间)配额用于管理租户(企业空间)中所有项目和 DevOps 项目的总资源用量。租户(企业空间)配额与[项目配额](../project-quotas/)相似，也包含 CPU 和内存的预留（Request）和限制（Limit）。预留确保租户(企业空间)中的项目能够获得其所需的资源，因为这些资源已经得到明确保障和预留。相反，限制则确保租户(企业空间)中的所有项目的资源用量不能超过特定数值。

在[多集群架构](../../multicluster-management/)中，由于您需要[将一个或多个集群分配到租户(企业空间)中](../../cluster-administration/cluster-settings/cluster-visibility-and-authorization/)，您可以设置该租户(企业空间)在不同集群上的资源用量。

本教程演示如何管理租户(企业空间)中的资源配额。

## 准备工作

您需要准备一个可用的租户(企业空间)和一个用户 (`ws-manager`)。该用户必须在平台层级具有 `workspaces-manager` 角色。有关更多信息，请参阅[创建租户(企业空间)、项目、用户和角色](../../quick-start/create-workspace-and-project/)。

## 设置租户(企业空间)配额

1. 使用 `ws-manager` 用户登录 Kube AI Hub Web 控制台，进入租户(企业空间)。

2. 在**租户(企业空间)设置**下，选择**租户(企业空间)配额**。

3. **租户(企业空间)配额**页面列有分配到该租户(企业空间)的全部可用集群，以及各集群的 CPU 限额、CPU 需求、内存限额和内存需求。

4. 在列表右侧点击**编辑配额**即可查看租户(企业空间)配额信息。默认情况下，Kube AI Hub 不为租户(企业空间)设置任何资源预留或资源限制。如需设置资源预留或资源限制来管理 CPU 和内存资源，您可以移动 <img src="/images/docs/v3.x/common-icons/slider.png" width="20" /> 至期望数值或直接输入期望数值。将字段设为空值表示不对资源进行预留或限制。

   {{< notice note >}}

   资源预留不能超过资源限制。

   {{</ notice >}} 

5. 配额设置完成后，点击**确定**。

## 另请参见

[项目配额](../project-quotas/)

[容器限制范围](../../project-administration/container-limit-ranges/)