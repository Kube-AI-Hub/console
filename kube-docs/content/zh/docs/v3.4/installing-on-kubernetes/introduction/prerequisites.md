---
title: "Prerequisites"
keywords: 'Kubernetes, Kube AI Hub, Prerequisites'
description: '了解在现有 Kubernetes 集群上安装 Kube AI Hub 的先决条件。'
linkTitle: "Prerequisites"
weight: 4120
---

您可以在虚拟机和裸机上安装 Kube AI Hub，同时配置 Kubernetes。此外，只要您的 Kubernetes 集群满足以下先决条件，Kube AI Hub 也可以部署在云托管和本地 Kubernetes 集群上。

## Kubernetes 版本

- **最低版本**：v1.28.x
- **建议版本**：v1.34.x
- **支持版本**：v1.28.x、v1.29.x、v1.30.x、v1.31.x、v1.32.x、v1.33.x、v1.34.x

检查 Kubernetes 版本：

```bash
kubectl version
```

输出应显示：

```
Client Version: v1.34.x
Server Version: v1.34.x
```

## 可用资源

- **CPU**：至少 2 核
- **内存**：至少 4 GB
- **磁盘**：至少 40 GB

## 默认 Storage Class

您的 Kubernetes 集群必须配置默认 Storage Class。检查方法：

```bash
kubectl get sc
```

输出应显示带有 `(default)` 注解的 Storage Class。如果没有，请设置：

```bash
kubectl patch storageclass <your-storage-class> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

## 网络要求

- 确保集群节点之间可以相互通信。
- 集群必须安装 CNI 插件（Calico、Flannel 等）。
- 如果您计划使用 Kube AI Hub 控制台，请确保端口 `30880` 可访问。

## 容器运行时

集群必须使用 **containerd** 作为容器运行时，不再支持 Docker。

检查容器运行时：

```bash
kubectl get nodes -o wide
```

`CONTAINER-RUNTIME` 列应显示 `containerd://...`。

## 架构支持

支持 x86_64 和 ARM64（aarch64）架构。

## Helm 版本

如果您计划使用 Helm 安装 Kube AI Hub，请确保已安装 Helm 3.x：

```bash
helm version
```
