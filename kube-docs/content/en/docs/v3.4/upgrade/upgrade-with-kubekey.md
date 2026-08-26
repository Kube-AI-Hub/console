---
title: "Upgrade with KubeKey"
keywords: "Kubernetes, upgrade, Kube AI Hub, 3.4, KubeKey"
description: "Use KubeKey to upgrade Kubernetes and Kube AI Hub."
linkTitle: "Upgrade with KubeKey"
weight: 7200
---
KubeKey is recommended for users whose Kube AI Hub and Kubernetes were both installed by [KubeKey](../../installing-on-linux/introduction/kubekey/). If your Kubernetes cluster was provisioned by yourself or cloud providers, refer to [Upgrade with ks-installer](../upgrade-with-ks-installer/).

This tutorial demonstrates how to upgrade your cluster using KubeKey.

## Prerequisites

- You need to have a Kube AI Hub cluster running v3.3.x. If your Kube AI Hub version is v3.2.x or earlier, upgrade to v3.3.x first.
- Read [Release Notes for 3.4.1](../../../v3.4/release/release-v341/) carefully.
- Back up any important component beforehand.
- Make your upgrade plan. Two scenarios are provided in this document for [all-in-one clusters](#all-in-one-cluster) and [multi-node clusters](#multi-node-cluster) respectively.

## Major Updates

In Kube AI Hub 3.4.1, some changes have made on built-in roles and permissions of custom roles. Therefore, before you upgrade Kube AI Hub to 3.4.1, please note the following:

   - Change of built-in roles: Platform-level built-in roles `users-manager` and `workspace-manager` are removed. If an existing user has been bound to `users-manager` or `workspace-manager`, its role will be changed to `platform-regular` after the upgrade is completed. Role `platform-self-provisioner` is added. For more information about built-in roles, refer to [Create a user](../../quick-start/create-workspace-and-project).

   - Some permission of custom roles are removed:
       - Removed permissions of platform-level custom roles: user management, role management, and workspace management.
       - Removed permissions of workspace-level custom roles: user management, role management, and user group management.
       - Removed permissions of namespace-level custom roles: user management and role management.
       - After you upgrade Kube AI Hub to 3.4.1, custom roles will be retained, but removed permissions of the custom roles will be revoked.

## Get KubeKey

KubeKey is included in the Kube AI Hub offline installation package. After extracting the package, select the binary for your architecture:

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

## Upgrade Kube AI Hub and Kubernetes

Upgrading steps are different for single-node clusters (all-in-one) and multi-node clusters.

{{< notice info >}}

When upgrading Kubernetes, KubeKey will upgrade from one MINOR version to the next MINOR version until the target version. For example, you may see the upgrading process going from 1.28 to 1.29 and to 1.30, instead of directly jumping to 1.30 from 1.28.

{{</ notice >}}

### All-in-one cluster

Run the following command to use KubeKey to upgrade your single-node cluster to Kube AI Hub 3.4 and Kubernetes v1.34.4:

```bash
./kk upgrade --with-kubernetes v1.34.4 --with-kubesphere v3.4.1
```

To upgrade Kubernetes to a specific version, explicitly provide the version after the flag `--with-kubernetes`. Available versions are v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, and v1.34.x (v1.34.x recommended).

### Multi-node cluster

#### Step 1: Generate a configuration file using KubeKey

This command creates a configuration file `sample.yaml` of your cluster.

```bash
./kk create config --from-cluster
```

{{< notice note >}}

It assumes your kubeconfig is allocated in `~/.kube/config`. You can change it with the flag `--kubeconfig`.

{{</ notice >}}

#### Step 2: Edit the configuration file template

Edit `sample.yaml` based on your cluster configuration. Make sure you replace the following fields correctly.

- `hosts`: The basic information of your hosts (hostname and IP address) and how to connect to them using SSH.
- `roleGroups.etcd`: Your etcd nodes.
- `controlPlaneEndpoint`: Your load balancer address (optional).
- `registry`: Your image registry information (optional).

{{< notice note >}}

For more information, see [Edit the configuration file](../../installing-on-linux/introduction/multioverview/#2-edit-the-configuration-file).

{{</ notice >}}

#### Step 3: Upgrade your cluster

The following command upgrades your cluster to Kube AI Hub 3.4 and Kubernetes v1.34.4:

```bash
./kk upgrade --with-kubernetes v1.34.4 --with-kubesphere v3.4.1 -f sample.yaml
```

To upgrade Kubernetes to a specific version, explicitly provide the version after the flag `--with-kubernetes`. Available versions are v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, and v1.34.x (v1.34.x recommended).

{{< notice note >}}

To use new features of Kube AI Hub 3.4, you may need to enable some pluggable components after the upgrade.

{{</ notice >}}
