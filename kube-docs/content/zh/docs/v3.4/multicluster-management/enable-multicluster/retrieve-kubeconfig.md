---
title: "获取 Kubeconfig"
keywords: 'Kubernetes, Kube AI Hub, 多集群, 混合云, kubeconfig'
description: '获取通过直接连接导入集群所需的 kubeconfig，并了解概览页中的 kubeconfig 入口。'
linkTitle: "获取 Kubeconfig"
weight: 5230
---

如果您使用[直接连接](../direct-connection/)导入成员集群，则需要提供 kubeconfig。对于已接入控制台的集群，被授予 `platform-admin` 角色的用户还可以从集群**概览**页的**工具**卡片打开 `kubeconfig` 入口，查看当前集群的访问配置。

![](/images/docs/v3.x/cluster-overview/tools-access.svg)

## 准备工作

您需要有一个 Kubernetes 集群，并具备读取该集群 kubeconfig 的权限。

## 从控制台进入 kubeconfig 页面

1. 使用被授予 `platform-admin` 角色的用户登录 Kube AI Hub。

2. 进入**平台管理** > **集群管理**，然后打开目标集群的**概览**页。

3. 在**工具**卡片中点击 **kubeconfig**。

4. 在打开的页面中查看、复制或下载当前集群的访问配置。

{{< notice info >}}

概览页中的 `kubeconfig` 入口适合已接入控制台的集群。如果您正在导入一个尚未加入平台的成员集群，请直接从该 Kubernetes 集群的管理节点获取 kubeconfig。

{{</ notice >}}

## 从 Kubernetes 节点获取 kubeconfig

对于待导入的成员集群，通常可以在控制平面节点或管理节点的 `$HOME/.kube/config` 中找到 kubeconfig。您可以运行以下命令查看原始内容：

```bash
kubectl config view --raw
```

输出内容类似如下：

```yaml
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: <certificate-authority-data>
    server: https://lb.kube-ai-hub.local:6443
  name: cluster.local
contexts:
- context:
    cluster: cluster.local
    user: kubernetes-admin
  name: kubernetes-admin@cluster.local
current-context: kubernetes-admin@cluster.local
kind: Config
preferences: {}
users:
- name: kubernetes-admin
  user:
    client-certificate-data: <client-certificate-data>
    client-key-data: <client-key-data>
```

## 在导入流程中使用 kubeconfig

1. 在 Kube AI Hub 控制台中选择通过**直接连接**导入成员集群。

2. 按页面提示粘贴或上传 kubeconfig 内容。

3. 确认 `server` 字段中的 API Server 地址可被主集群访问。

4. 提交导入任务并等待集群状态更新。

{{< notice warning >}}

kubeconfig 通常包含 API Server 地址、证书和身份凭据。请妥善保管，不要在公开场景中直接泄露。

{{</ notice >}}
