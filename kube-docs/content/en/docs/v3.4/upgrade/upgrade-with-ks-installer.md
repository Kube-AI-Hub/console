---
title: "Upgrade with ks-installer"
keywords: "Kubernetes, upgrade, Kube AI Hub, v3.4.1"
description: "Use ks-installer to upgrade Kube AI Hub."
linkTitle: "Upgrade with ks-installer"
weight: 7300
---

ks-installer is recommended for users whose Kubernetes clusters were not set up by [KubeKey](../../installing-on-linux/introduction/kubekey/), but hosted by cloud vendors or created by themselves. This tutorial is for **upgrading Kube AI Hub only**. Cluster operators are responsible for upgrading Kubernetes beforehand.

## Prerequisites

- You need to have a Kube AI Hub cluster running v3.3.x. If your Kube AI Hub version is v3.2.x or earlier, upgrade to v3.3.x first.
- Read [Release Notes for 3.4.1](../../../v3.4/release/release-v341/) carefully.
- Back up any important component beforehand.
- Supported Kubernetes versions of Kube AI Hub 3.4: v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, and v1.34.x (v1.34.x recommended).

## Major Updates

In Kube AI Hub 3.4.1, some changes have made on built-in roles and permissions of custom roles. Therefore, before you upgrade Kube AI Hub to 3.4.1, please note the following:

   - Change of built-in roles: Platform-level built-in roles `users-manager` and `workspace-manager` are removed. If an existing user has been bound to `users-manager` or `workspace-manager`, its role will be changed to `platform-regular` after the upgrade is completed. Role `platform-self-provisioner` is added. For more information about built-in roles, refer to [Create a user](../../quick-start/create-workspace-and-project).

   - Some permission of custom roles are removed:
       - Removed permissions of platform-level custom roles: user management, role management, and tenant (workspace) management.
       - Removed permissions of workspace-level custom roles: user management, role management, and user group management.
       - Removed permissions of namespace-level custom roles: user management and role management.
       - After you upgrade Kube AI Hub to 3.4.1, custom roles will be retained, but removed permissions of the custom roles will be revoked.

## Apply ks-installer

Run the following command to upgrade your cluster.

```bash
# Obtain the YAML files from the delivery channel
kubectl apply -f kubesphere-installer.yaml --force
```

## Enable Pluggable Components

You can [enable new pluggable components](../../pluggable-components/overview/) of Kube AI Hub 3.4 after the upgrade to explore more features of the container platform.

