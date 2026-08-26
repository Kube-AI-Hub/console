---
title: "Upgrade — Overview"
keywords: "Kubernetes, upgrade, Kube AI Hub, 3.4, upgrade"
description: "Understand what you need to pay attention to before the upgrade, such as versions, and upgrade tools."
linkTitle: "Overview"
weight: 7100
---

## Make Your Upgrade Plan

Kube AI Hub 3.4 is compatible with Kubernetes v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, and v1.34.x:

- Before you upgrade your cluster to Kube AI Hub 3.4, you need to have a Kube AI Hub cluster running v3.3.x.
- You can choose to only upgrade Kube AI Hub to 3.4 or upgrade Kubernetes (to a higher version) and Kube AI Hub (to 3.4) at the same time.
- It is recommended to upgrade Kubernetes to v1.34.x for optimal compatibility and feature support.

## Before the Upgrade

{{< notice warning >}}

- You are supposed to implement a simulation for the upgrade in a testing environment first. After the upgrade is successful in the testing environment and all applications are running normally, upgrade your cluster in your production environment.
- During the upgrade process, there may be a short interruption of applications (especially for those single-replica Pods). Please arrange a reasonable period of time for your upgrade.
- It is recommended to back up etcd and stateful applications before in production. You can use [Velero](https://velero.io/) to implement the backup and migrate Kubernetes resources and persistent volumes.

{{</ notice >}}

## Upgrade Tool

Depending on how your existing cluster was set up, you can use KubeKey or ks-installer to upgrade your cluster. It is recommended that you [use KubeKey to upgrade your cluster](../upgrade-with-kubekey/) if it was created by KubeKey. Otherwise, [use ks-installer to upgrade your cluster](../upgrade-with-ks-installer/).
