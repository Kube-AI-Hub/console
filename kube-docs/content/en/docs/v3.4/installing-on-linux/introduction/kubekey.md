---
title: "KubeKey"
keywords: 'KubeKey, Installation, Kube AI Hub'
description: 'Learn the KubeKey concept and how KubeKey helps you create, scale, and upgrade Kubernetes clusters.'
linkTitle: "KubeKey"
weight: 3120
---

KubeKey (developed in Go) is a brand-new installation tool that replaces the previous ansible-based installer. KubeKey provides flexible installation options. You can install Kubernetes only, or install Kubernetes and Kube AI Hub together.

KubeKey usage scenarios:

- Install Kubernetes only;
- Install Kubernetes and Kube AI Hub together with one command;
- Scale clusters;
- Upgrade clusters;
- Install Kubernetes-related plugins (Chart or YAML).

## How KubeKey Works

KubeKey is included in the Kube AI Hub offline installation package. After extracting the package, you can use the executable `kk` for different operations. Whether you use it to create, scale, or upgrade a cluster, you must prepare configuration files first. The configuration files contain basic cluster parameters such as host information, network configuration (CNI plugin, Pod and Service CIDR), registry mirrors, plugins (YAML or Chart), and pluggable component options (if you install Kube AI Hub).

After preparing the configuration files, you use the `./kk` command with different flags for different operations. KubeKey automatically installs containerd and pulls all necessary images for installation. After installation, you can also check the installation logs.

## Why KubeKey

- The previous ansible-based installer depended on many software packages such as Python. KubeKey is developed in Go, which eliminates issues in various environments and ensures successful installation.
- KubeKey supports multiple installation options, such as [All-in-One](../../../quick-start/all-in-one-on-linux/), [Multi-node Installation](../multioverview/), and [Air-gapped Installation](../air-gapped-installation/).
- KubeKey uses Kubeadm to install Kubernetes clusters in parallel on nodes as much as possible, making installation easier and more efficient. It greatly saves installation time compared to the old installer.
- KubeKey provides [built-in high availability mode](../../high-availability-configurations/internal-ha-configuration/), supporting one-click installation of HA Kubernetes clusters.
- KubeKey is designed to install clusters as objects, i.e., CaaO.

## Get KubeKey

KubeKey is included in the Kube AI Hub offline installation package and does not need to be downloaded separately. After extracting the package, select the binary for your architecture:

```bash
# x86_64 architecture
mv kk-x86 kk

# ARM64 architecture
mv kk-arm kk

chmod +x kk
```

{{< notice note >}}

Obtain the offline installation package from your delivery channel. The package includes Kubernetes v1.34.4, containerd, and required images.

{{</ notice >}}

## Support Matrix

To use KubeKey to install Kubernetes and Kube AI Hub 3.4, see the table below for all supported Kubernetes versions.

| Kube AI Hub Version | Supported Kubernetes Versions |
| ------------------- | ----------------------------- |
| v3.4                | v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, v1.34.x (v1.34.x recommended) |

{{< notice note >}}

- You can also run `./kk version --show-supported-k8s` to see all supported Kubernetes versions that can be installed with KubeKey.
- The offline installation package installs Kubernetes v1.34.4 by default.
- To [install Kube AI Hub 3.4 on an existing Kubernetes cluster](../../../installing-on-kubernetes/introduction/overview/), your Kubernetes version must be v1.28.x or later.

{{</ notice >}}
