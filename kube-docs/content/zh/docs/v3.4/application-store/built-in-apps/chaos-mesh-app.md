---
title: "在 Kube AI Hub 中部署 Chaos Mesh"
keywords: 'Kube AI Hub, Kubernetes, Chaos Mesh, Chaos Engineering'
description: '了解如何在 Kube AI Hub 中部署 Chaos Mesh 并进行混沌实验。'
linkTitle: "部署 Chaos Mesh"
---

[Chaos Mesh](https://github.com/chaos-mesh/chaos-mesh) 是一个开源的云原生混沌工程平台，提供丰富的故障模拟类型，具有强大的故障场景编排能力，方便用户在开发测试中以及生产环境中模拟现实世界中可能出现的各类异常，帮助用户发现系统潜在的问题。

![Chaos Mesh architecture](/images/docs/v3.x/appstore/built-in-apps/deploy-chaos-mesh/chaos-mesh-architecture.svg)

本教程演示了如何在 Kube AI Hub 上部署 Chaos Mesh 进行混沌实验。

## **准备工作**

* 部署 [Kube AI Hub 应用商店](../../../pluggable-components/app-store/)。
* 您需要为本教程创建一个企业空间、一个项目和两个帐户（ws-admin 和 project-regular）。帐户 ws-admin 必须在企业空间中被赋予 workspace-admin 角色，帐户 project-regular 必须被邀请至项目中赋予 operator 角色。若还未创建好，请参考[创建企业空间、项目、用户和角色](https://kubesphere.io/zh/docs/quick-start/create-workspace-and-project/)。


## **开始混沌实验**

### 步骤1: 部署 Chaos Mesh 

1. 使用 `project-regular` 身份登录，在**应用商店**中搜索 `chaos-mesh`，进入应用详情页。

2. 点击右上角**安装**，设置应用**名称**、安装**位置**（对应 Namespace）和**版本**，然后继续下一步。

3. 根据实际需要编辑 `values.yaml`，或直接使用默认配置完成安装。

4. 等待应用状态变为运行中。

5. 安装完成后，前往**应用负载**检查 Chaos Mesh 创建的部署和服务是否已就绪。

### 步骤 2: 访问 Chaos Mesh

1. 前往**应用负载**下的服务页面，找到 `chaos-dashboard` 服务并复制其 **NodePort**。

2. 您可以通过 `${NodeIP}:${NODEPORT}` 方式访问 Chaos Dashboard。并参考[管理用户权限](https://chaos-mesh.org/zh/docs/manage-user-permissions/)文档，生成 Token，并登陆 Chaos Dashboard。

    ![Login to Chaos Dashboard](/images/docs/v3.x/zh-cn/appstore/built-in-apps/deploy-chaos-mesh/login-to-dashboard.png)

### 步骤 3: 创建混沌实验

1. 在开始混沌实验之前，需要先确定并部署您的实验目标，比如，测试某应用在网络延时下的工作状态。本文使用了一个 demo 应用 `web-show` 作为待测试目标，观测系统网络延迟。 你可以使用下面命令部署一个 Demo 应用 `web-show` ： 

    ```bash
    curl -sSL https://mirrors.chaos-mesh.org/latest/web-show/deploy.sh | bash
    ```  

    {{< notice note >}}

    web-show 应用页面上可以直接观察到自身到 kube-system 命名空间下 Pod 的网络延迟。

    {{</ notice >}}

2. 访问 **web-show** 应用程序。从您的网络浏览器，进入 `${NodeIP}:8081`。

    ![Chaos Mesh web show app](/images/docs/v3.x/zh-cn/appstore/built-in-apps/deploy-chaos-mesh/web-show-app.png)

3. 登陆 Chaos Dashboard 创建混沌实验，为了更好的观察混沌实验效果，这里只创建一个独立的混沌实验，混沌实验的类型选择**网络攻击**，模拟网络延迟的场景：

    ![Chaos Dashboard](/images/docs/v3.x/zh-cn/appstore/built-in-apps/deploy-chaos-mesh/chaos-dashboard-networkchaos.png)

    实验范围设置为 web-show 应用：

    ![Chaos Experiment scope](/images/docs/v3.x/zh-cn/appstore/built-in-apps/deploy-chaos-mesh/chaos-experiment-scope.png)

4. 提交混沌实验后，查看实验状态：

    ![Chaos Experiment status](/images/docs/v3.x/zh-cn/appstore/built-in-apps/deploy-chaos-mesh/experiment-status.png)

5. 访问 web-show 应用观察实验结果 ：

    ![Chaos Experiment result](/images/docs/v3.x/zh-cn/appstore/built-in-apps/deploy-chaos-mesh/experiment-result.png)

更多详情参考 [Chaos Mesh 使用文档](https://chaos-mesh.org/zh/docs/)。