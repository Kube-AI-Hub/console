---
title: "从 Kubernetes 上卸载 Kube AI Hub"
keywords: 'Kubernetes, Kube AI Hub, 卸载, 移除集群'
description: '从 Kubernetes 集群中删除 Kube AI Hub。'
LinkTitle: "从 Kubernetes 上卸载 Kube AI Hub"
weight: 4400
---

您可以使用 [kubesphere-delete.sh](https://github.com/Kube-AI-Hub/ks-installer/blob/release-3.4/scripts/kubesphere-delete.sh) 将 Kube AI Hub 从您现有的 Kubernetes 集群中卸载。复制 [GitHub 源文件](https://raw.githubusercontent.com/Kube-AI-Hub/ks-installer/release-3.4/scripts/kubesphere-delete.sh)并在本地机器上执行此脚本。

{{< notice warning >}}

卸载意味着 Kube AI Hub 会从您的 Kubernetes 集群中移除。此操作不可逆并且没有任何备份，请谨慎操作。

{{</ notice >}}