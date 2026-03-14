---
title: "概述"
keywords: "Kube AI Hub, Kubernetes, 安装"
description: "了解在已有 Kubernetes 集群上部署 Kube AI Hub 的一般步骤。"

linkTitle: "概述"
weight: 4110
---

Kube AI Hub 承诺为用户提供即插即用架构，您可以轻松地将 Kube AI Hub 安装在现有的 Kubernetes 集群上。更具体地说，Kube AI Hub 既可以部署于托管在云端（例如 AWS EKS、青云 QingCloud QKE 和 Google GKE 等）的 Kubernetes 服务上，也可以部署在本地 Kubernetes 集群上。这是因为 Kube AI Hub 不会侵入 Kubernetes，它仅与 Kubernetes API 交互，以管理 Kubernetes 集群资源。换句话说，Kube AI Hub 可以安装在任何原生 Kubernetes 集群和 Kubernetes 发行版上。

本节概述了在 Kubernetes 上安装 Kube AI Hub 的一般步骤。有关在不同环境中特定安装方式的更多信息，请参见在托管 Kubernetes 上安装和在本地 Kubernetes 上安装。

{{< notice note >}}

在现有 Kubernetes 集群上安装 Kube AI Hub 之前，请参阅[准备工作](../prerequisites/)。

{{</ notice >}}

## 部署 Kube AI Hub

确保现有的 Kubernetes 集群满足所有要求之后，您可以使用 kubectl 以默认最小安装包来安装 Kube AI Hub。

1. 执行以下命令以开始安装：

   ```bash
   kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/kubesphere-installer.yaml

   kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/cluster-configuration.yaml
   ```

2. 检查安装日志：

   ```bash
   kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
   ```

3. 使用 `kubectl get pod --all-namespaces` 查看所有 Pod 在 Kube AI Hub 相关的命名空间是否正常运行。如果是正常运行，请通过以下命令来检查控制台的端口（默认为 30880）：

   ```bash
   kubectl get svc/ks-console -n kubesphere-system
   ```

4. 确保在安全组中打开了 30880 端口，通过 NodePort (`IP:30880`) 使用默认帐户和密码 (`admin/P@88w0rd`) 访问 Web 控制台。登录后，建议先检查集群概览和系统组件状态，并尽快修改默认密码。

## 启用可插拔组件（可选）

如果您使用默认的最小化安装，请参考[启用可插拔组件](../../../pluggable-components/)来安装其他组件。

{{< notice tip >}}

- 您可以在 Kube AI Hub 安装之前或之后启用可插拔组件。请参考示例文件 [cluster-configuration.yaml](https://github.com/kubesphere/ks-installer/blob/master/deploy/cluster-configuration.yaml) 获取更多详细信息。
- 请确保集群中有足够的 CPU 和内存。
- 强烈建议安装这些可插拔组件，以体验 Kube AI Hub 提供的全栈功能。

{{</ notice >}}
