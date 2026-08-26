---
title: "Prerequisites"
keywords: 'Kubernetes, Kube AI Hub, Prerequisites'
description: 'Learn the prerequisites for installing Kube AI Hub on existing Kubernetes clusters.'
linkTitle: "Prerequisites"
weight: 4120
---

You can install Kube AI Hub on virtual machines and bare metal with Kubernetes also provisioned. In addition, Kube AI Hub can also be deployed on cloud-hosted and on-premises Kubernetes clusters as long as your Kubernetes cluster meets the prerequisites below.

## Kubernetes Version

- **Minimum version**: v1.28.x
- **Recommended version**: v1.34.x
- **Supported versions**: v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, v1.34.x

To check your Kubernetes version, run:

```bash
kubectl version
```

The output should show:

```
Client Version: v1.34.x
Server Version: v1.34.x
```

## Available Resources

- **CPU**: At least 2 cores
- **Memory**: At least 4 GB
- **Disk**: At least 40 GB

## Default Storage Class

Your Kubernetes cluster must have a default Storage Class configured. To check, run:

```bash
kubectl get sc
```

The output should show a Storage Class with `(default)` annotation. If not, set one:

```bash
kubectl patch storageclass <your-storage-class> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

## Network Requirements

- Ensure that the cluster nodes can communicate with each other.
- The cluster must have a CNI plugin installed (Calico, Flannel, etc.).
- If you plan to use the Kube AI Hub console, ensure that port `30880` is accessible.

## Container Runtime

The cluster must use **containerd** as the container runtime. Docker is no longer supported.

To check your container runtime, run:

```bash
kubectl get nodes -o wide
```

The `CONTAINER-RUNTIME` column should show `containerd://...`.

## Architecture Support

Both x86_64 and ARM64 (aarch64) architectures are supported.

## Helm Version

If you plan to install Kube AI Hub using Helm, ensure Helm 3.x is installed:

```bash
helm version
```
