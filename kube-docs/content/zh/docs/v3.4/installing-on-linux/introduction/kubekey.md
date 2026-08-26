---
title: "KubeKey"
keywords: 'KubeKey，安装，Kube AI Hub'
description: '了解 KubeKey 概念以及 KubeKey 如何帮您创建、扩缩和升级 Kubernetes 集群。'
linkTitle: "KubeKey"
weight: 3120
---

KubeKey（由 Go 语言开发）是一种全新的安装工具，替代了以前使用的基于 ansible 的安装程序。KubeKey 为您提供灵活的安装选择，您可以仅安装 Kubernetes，也可以同时安装 Kubernetes 和 Kube AI Hub。

KubeKey 的几种使用场景：

- 仅安装 Kubernetes；
- 使用一个命令同时安装 Kubernetes 和 Kube AI Hub；
- 扩缩集群；
- 升级集群；
- 安装 Kubernetes 相关的插件（Chart 或 YAML）。

## KubeKey 如何运作

KubeKey 已包含在 Kube AI Hub 离线安装包中。解压离线包后，您可以使用可执行文件 `kk` 来进行不同的操作。无论您是使用它来创建，扩缩还是升级集群，都必须事先准备配置文件。配置文件包含集群的基本参数，例如主机信息、网络配置（CNI 插件以及 Pod 和 Service CIDR）、仓库镜像、插件（YAML 或 Chart）和可插拔组件选项（如果您安装 Kube AI Hub）。

准备好配置文件后，您需要使用 `./kk` 命令以及不同的标志来进行不同的操作。KubeKey 会自动安装 containerd，并拉取所有必要的镜像以进行安装。安装完成后，您还可以检查安装日志。

## 为什么选择 KubeKey

- 以前基于 ansible 的安装程序依赖于许多软件，例如 Python。KubeKey 由 Go 语言开发，可以消除在多种环境中出现的问题，确保成功安装。
- KubeKey 支持多种安装选项，例如 [All-in-One](../../../quick-start/all-in-one-on-linux/)、[多节点安装](../multioverview/)以及[离线安装](../air-gapped-installation/)。
- KubeKey 使用 Kubeadm 在节点上尽可能多地并行安装 Kubernetes 集群，使安装更简便，提高效率。与旧版的安装程序相比，它极大地节省了安装时间。
- KubeKey 提供[内置高可用模式](../../high-availability-configurations/internal-ha-configuration/)，支持一键安装高可用 Kubernetes 集群。
- KubeKey 旨在将集群作为对象来进行安装，即 CaaO。

## 获取 KubeKey

KubeKey 已包含在 Kube AI Hub 离线安装包中，无需单独下载。解压离线包后，根据您的架构选择对应的二进制文件：

```bash
# x86_64 架构
mv kk-x86 kk

# ARM64 架构
mv kk-arm kk

chmod +x kk
```

{{< notice note >}}

离线安装包请从交付渠道获取。包内已包含 Kubernetes v1.34.4、containerd 及所需镜像。

{{</ notice >}}

## 支持矩阵

若需使用 KubeKey 来安装 Kubernetes 和 Kube AI Hub 3.4，请参见下表以查看所有受支持的 Kubernetes 版本。

| Kube AI Hub 版本 | 受支持的 Kubernetes 版本 |
| ---------------- | ------------------------ |
| v3.4             | v1.28.x、v1.29.x、v1.30.x、v1.31.x、v1.32.x、v1.33.x、v1.34.x（建议 v1.34.x） |

{{< notice note >}}

- 您也可以运行 `./kk version --show-supported-k8s`，查看能使用 KubeKey 安装的所有受支持的 Kubernetes 版本。
- 离线安装包默认安装 Kubernetes v1.34.4。
- 如需[在现有 Kubernetes 集群上安装 Kube AI Hub 3.4](../../../installing-on-kubernetes/introduction/overview/)，您的 Kubernetes 版本必须为 v1.28.x 及以上。

{{</ notice >}}
