---
title: "Install a Multi-node Kubernetes and Kube AI Hub Cluster"
keywords: 'Multi-node, Installation, Kube AI Hub'
description: 'Learn the general steps of installing Kube AI Hub and Kubernetes on a multi-node cluster.'
linkTitle: "Multi-node Installation"
weight: 3130
---

In a production environment, a single-node cluster cannot satisfy most of the needs as the cluster has limited resources with insufficient compute capabilities. Thus, single-node clusters are not recommended for large-scale data processing. Besides, a cluster of this kind is not available with high availability as it only has one node. On the other hand, a multi-node architecture is the most common and preferred choice in terms of application deployment and distribution.

This section gives you an overview of a single-master multi-node installation, including the concept, KubeKey and steps. For information about HA installation, refer to [High Availability Configurations](../../../installing-on-linux/high-availability-configurations/ha-configuration/), [Installing on Public Cloud](../../public-cloud/install-kubesphere-on-azure-vms/) and [Installing in On-premises Environment](../../on-premises/install-kubesphere-on-bare-metal/).

## Concept

A multi-node cluster is composed of at least one control plane and one worker node. You can use any node as the **taskbox** to carry out the installation task. You can add additional nodes based on your needs (for example, for high availability) both before and after the installation.

- **Control plane node**. The control plane generally hosts the control plane and controls and manages the whole system.

- **Worker node**. Worker nodes run the actual applications deployed on them.

## Step 1: Prepare Linux Hosts

Please see the requirements for hardware and operating system shown below. To get started with multi-node installation in this tutorial, you need to prepare at least three hosts according to the following requirements. It is possible to install the Kube AI Hub Container Platform on two nodes if they have sufficient resources.

### System requirements

| Systems | Minimum Requirements (Each node) |
| ------- | -------------------------------- |
| **Ubuntu** *22.04*, *24.04* (24.04 or later recommended) | CPU: 2 Cores, Memory: 4 G, Disk Space: 40 G |
| **CentOS** *9* or later | CPU: 2 Cores, Memory: 4 G, Disk Space: 40 G |
| **Kylin** *V10* | CPU: 2 Cores, Memory: 4 G, Disk Space: 40 G |
| **openEuler** *22.03 LTS* or later | CPU: 2 Cores, Memory: 4 G, Disk Space: 40 G |

{{< notice note >}}

- The path `/var/lib/containerd` is mainly used to store the container data, and will gradually increase in size during use and operation. In the case of a production environment, it is recommended that `/var/lib/containerd` should mount a drive separately.

- Both x86_64 and ARM64 (aarch64) architectures are supported.

{{</ notice >}}

### Node requirements

- All nodes must be accessible through `SSH`.
- Time synchronization for all nodes.
- `sudo`/`curl`/`openssl`/`tar` should be used in all nodes.
- If nodes are equipped with NVIDIA GPUs or Huawei Ascend NPUs, install drivers and container runtimes before cluster creation. See [GPU Driver Installation](../gpu-driver-installation/).

### Container runtimes

The cluster uses **containerd** as the container runtime. Docker is no longer supported. If you use KubeKey to set up a cluster, KubeKey will install containerd automatically.

| Supported Container Runtime | Version |
| --------------------------- | ------- |
| containerd | 1.7+ |

{{< notice note >}}

For offline deployment, containerd is included in the offline installation package and does not need to be installed separately.

{{</ notice >}}

### Dependency requirements

KubeKey can install Kubernetes and Kube AI Hub together. The dependency that needs to be installed may be different based on the Kubernetes version to be installed. You can refer to the list below to see if you need to install relevant dependencies on your node in advance.

| Dependency  | Kubernetes Version ≥ 1.28 |
| ----------- | ------------------------- |
| `socat`     | Required                  |
| `conntrack` | Required                  |
| `ebtables`  | Optional but recommended  |
| `ipset`     | Optional but recommended  |

### Network and DNS requirements

- Make sure the DNS address in `/etc/resolv.conf` is available. Otherwise, it may cause some issues of DNS in clusters.
- If your network configuration uses firewall rules or security groups, you must ensure infrastructure components can communicate with each other through specific ports. It's recommended that you turn off the firewall or follow the guide [Port Requirements](../port-firewall/).
- Supported CNI plugins: Calico and Flannel. Others (such as Cilium and Kube-OVN) may also work but note that they have not been fully tested.

{{< notice tip >}}

- It's recommended that your OS be clean (without any other software installed). Otherwise, there may be conflicts.
- A registry mirror (booster) is recommended to be prepared if you have trouble downloading images from `dockerhub.io`.

{{</ notice >}}

This example includes three hosts as below with the control plane serving as the taskbox.

| Host IP     | Host Name | Role         |
| ----------- | --------- | ------------ |
| 192.168.0.2 | control plane    | control plane, etcd |
| 192.168.0.3 | node1     | worker       |
| 192.168.0.4 | node2     | worker       |

## Step 2: Get KubeKey

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

## Step 3: Create a Kubernetes Multi-node Cluster

For multi-node installation, you need to create a cluster by specifying configuration files.

### 1. Prepare configuration files

The offline package contains example configuration files. You need to prepare two files:

- `inventory.yaml`: Defines the node inventory and role groups
- `config.yaml`: Defines cluster parameters (network, storage, image registry, etc.)

Here is an example `inventory.yaml`:

```yaml
apiVersion: kubekey.kubesphere.io/v1
kind: Inventory
metadata:
  name: default
spec:
  hosts:
    control-plane:
      connector:
        type: ssh
        host: 192.168.0.2
        port: 22
        user: root
        private_key: /root/.ssh/id_rsa
      arch: amd64
      internal_ipv4: 192.168.0.2
    node1:
      connector:
        type: ssh
        host: 192.168.0.3
        port: 22
        user: root
        private_key: /root/.ssh/id_rsa
      arch: amd64
      internal_ipv4: 192.168.0.3
    node2:
      connector:
        type: ssh
        host: 192.168.0.4
        port: 22
        user: root
        private_key: /root/.ssh/id_rsa
      arch: amd64
      internal_ipv4: 192.168.0.4
  groups:
    k8s_cluster:
      groups:
        - kube_control_plane
        - kube_worker
    kube_control_plane:
      hosts:
        - control-plane
    kube_worker:
      hosts:
        - node1
        - node2
    etcd:
      hosts:
        - control-plane
    image_registry:
      hosts:
        - control-plane
```

{{< notice note >}}

- Modify `inventory.yaml` according to your actual node IPs, hostnames, and architecture (`amd64` or `arm64`).
- Configure parameters such as image registry storage path in `config.yaml`. Refer to the example files in the offline package.
- Recommended Kubernetes versions for Kube AI Hub 3.4: v1.28.x or later, v1.34.x recommended. The offline package installs Kubernetes v1.34.4 by default.

{{</ notice >}}

### 2. Create the cluster

```bash
./kk create cluster -i inventory.yaml -c config.yaml
```

The whole installation process may take 10-20 minutes, depending on your machine and network.

### 3. Verify the installation

When the installation finishes, you can see the content as follows:

```bash
#####################################################
###              Welcome to Kube AI Hub!           ###
#####################################################

Console: http://192.168.0.2:30880
Account: admin
Password: P@88w0rd

NOTES：
  1. After you log into the console, please check the
     monitoring status of service components in
     the "Cluster Management". If any service is not
     ready, please wait patiently until all components
     are up and running.
  2. Please change the default password after login.

#####################################################
```

Now, you will be able to access the web console of Kube AI Hub at `<NodeIP>:30880` with the default account and password (`admin/P@88w0rd`).

{{< notice note >}}

To access the console, you may need to configure port forwarding rules depending on your environment. Please also make sure port `30880` is opened in your security group.

{{</ notice >}}

## Enable kubectl Autocompletion

KubeKey doesn't enable kubectl autocompletion. See the content below and turn it on:

{{< notice note >}}

Make sure bash-autocompletion is installed and works.

{{</ notice >}}

```bash
# Install bash-completion
apt-get install bash-completion

# Source the completion script in your ~/.bashrc file
echo 'source <(kubectl completion bash)' >>~/.bashrc

# Add the completion script to the /etc/bash_completion.d directory
kubectl completion bash >/etc/bash_completion.d/kubectl
```

Detailed information can be found [here](https://kubernetes.io/docs/tasks/tools/install-kubectl/#enabling-shell-autocompletion).
