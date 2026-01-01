---
title: "Installing on Linux — Overview"
keywords: 'Kubernetes, Kube AI Hub, Linux, Installation'
description: 'Explore the general content in this chapter, including installation preparation, installation tool and method, and storage configurations.'
linkTitle: "Overview"
weight: 3110
---

As an open-source project on [GitHub](https://github.com/kubesphere), Kube AI Hub is home to a community with thousands of users. Many of them are running Kube AI Hub for their production workloads. For the installation on Linux, Kube AI Hub can be deployed both in clouds and in on-premises environments, such as AWS EC2, Azure VM and bare metal.

The installation process is easy and friendly as Kube AI Hub provides users with [KubeKey](https://github.com/kubesphere/kubekey), a lightweight installer that supports the installation of Kubernetes, Kube AI Hub and related add-ons. KubeKey not only helps users to create clusters online but also serves as an air-gapped installation solution.

Here is a list of available installation options.

- [All-in-one installation](../../../quick-start/all-in-one-on-linux/): Install Kube AI Hub on a single node. It is only for users to quickly get familiar with Kube AI Hub.
- [Multi-node installation](../multioverview/): Install Kube AI Hub on multiple nodes. It is for testing or development.
- [Air-gapped installation on Linux](../air-gapped-installation/): All images of Kube AI Hub have been encapsulated into a package. It is convenient for air-gapped installation on Linux machines.
- [High availability installation](../../../installing-on-linux/high-availability-configurations/ha-configuration/): Install a highly-available Kube AI Hub cluster with multiple nodes which is used for production.
- Minimal Packages: Only install the minimum required system components of Kube AI Hub. Here is the minimum resource requirement:
  - 2 CPUs
  - 4 GB RAM
  - 40 GB Storage
- [Full Packages](../../../pluggable-components/): Install all available system components of Kube AI Hub such as DevOps, service mesh, and alerting.

{{< notice note >}}

Not all options are mutually exclusive. For instance, you can deploy Kube AI Hub with the minimal package on multiple nodes in an air-gapped environment.

{{</ notice >}} 

If you have an existing Kubernetes cluster, see [Overview of Installing on Kubernetes](../../../installing-on-kubernetes/introduction/overview/).

## Before Installation

- As images will be pulled from the Internet, your environment must have Internet access. Otherwise, you need to [install Kube AI Hub in an air-gapped environment](../air-gapped-installation/).
- For all-in-one installation, the only one node is both the control plane and the worker.
- For multi-node installation, you need to provide host information in a configuration file.
- See [Port Requirements](../port-firewall/) before installation.

## KubeKey

[KubeKey](https://github.com/kubesphere/kubekey) provides an efficient approach to the installation and configuration of your cluster. You can use it to create, scale, and upgrade your Kubernetes cluster. It also allows you to install cloud-native add-ons (YAML or Chart) as you set up your cluster. For more information, see [KubeKey](../kubekey).

## Quick Installation for Development and Testing

Kube AI Hub has decoupled some components since v2.1.0. KubeKey only installs necessary components by default as this way features fast installation and minimal resource consumption. If you want to enable enhanced pluggable functionalities, see [Enable Pluggable Components](../../../pluggable-components/) for details.

The quick installation of Kube AI Hub is only for development or testing since it uses [Local Volume](https://kubernetes.io/docs/concepts/storage/volumes/#local) based on [openEBS](https://openebs.io/) to provide storage services by default. If you want a production installation, see [High Availability Configurations](../../../installing-on-linux/high-availability-configurations/ha-configuration/).

## Storage Configurations

Kube AI Hub allows you to configure persistent storage services both before and after installation. Meanwhile, Kube AI Hub supports a variety of open-source storage solutions (for example, Ceph and GlusterFS) as well as commercial storage products. Refer to [Persistent Storage Configurations](../../../installing-on-linux/persistent-storage-configurations/understand-persistent-storage/) for detailed instructions regarding how to configure the storage class before you install Kube AI Hub.

For more information about how to set different storage classes for your workloads after you install Kube AI Hub, see [Storage Classes](../../../cluster-administration/storageclass/).

## Cluster Operation and Maintenance

### Add new nodes

With KubeKey, you can increase the number of nodes to meet higher resource needs after the installation, especially in production. For more information, see [Add New Nodes](../../../installing-on-linux/cluster-operation/add-new-nodes/).

### Remove nodes

You need to drain a node before you remove it. For more information, see [Remove Nodes](../../../installing-on-linux/cluster-operation/remove-nodes/).

## Uninstalling

Uninstalling Kube AI Hub means it will be removed from your machine, which is irreversible. Please be cautious with the operation.

For more information, see [Uninstall Kube AI Hub and Kubernetes](../../../installing-on-linux/uninstall-kubesphere-and-kubernetes/).
