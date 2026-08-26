---
title: "多节点安装"
keywords: '多节点, 安装, Kube AI Hub'
description: '了解在多节点集群上安装 Kube AI Hub 和 Kubernetes 的一般步骤。'
linkTitle: "多节点安装"
weight: 3120
---

在生产环境中，由于单节点集群资源有限、计算能力不足，无法满足大部分需求，因此不建议在处理大规模数据时使用单节点集群。此外，单节点集群只有一个节点，因此也不具有高可用性。相比之下，在应用程序部署和分发方面，多节点架构是最常见的首选架构。

本节概述了多节点安装，包括概念、KubeKey 和操作步骤。有关高可用安装的信息，请参考[高可用配置](../../../installing-on-linux/high-availability-configurations/ha-configuration/)、[在公有云上安装](../../../installing-on-linux/public-cloud/install-kubesphere-on-azure-vms/)和[在本地环境中安装](../../../installing-on-linux/on-premises/install-kubesphere-on-bare-metal/)。

## 概念

多节点集群由至少一个主节点和一个工作节点组成。您可以使用任何节点作为**任务机**来执行安装任务，也可以在安装之前或之后根据需要新增节点（例如，为了实现高可用性）。

- **Control plane node**：主节点，通常托管控制平面，控制和管理整个系统。

- **Worker node**：工作节点，运行部署在工作节点上的实际应用程序。

## 步骤 1：准备 Linux 主机

请参见下表列出的硬件和操作系统要求。在本教程所演示多节点安装示例中，您需要按照下列要求准备至少三台主机。如果您节点的资源充足，也可以将 Kube AI Hub 容器平台安装在两个节点上。

### 系统要求

| 系统 | 最低要求（每个节点） |
| ---- | -------------------- |
| **Ubuntu** *22.04*，*24.04*（建议 24.04 及以上） | CPU：2 核，内存：4 G，硬盘：40 G |
| **CentOS** *9* 及以上 | CPU：2 核，内存：4 G，硬盘：40 G |
| **麒麟 Kylin** *V10* | CPU：2 核，内存：4 G，硬盘：40 G |
| **openEuler** *22.03 LTS* 及以上 | CPU：2 核，内存：4 G，硬盘：40 G |

{{< notice note >}}

- `/var/lib/containerd` 路径主要用于存储容器数据，在使用和操作过程中数据量会逐渐增加。因此，在生产环境中，建议为 `/var/lib/containerd` 单独挂载一个硬盘。

- 支持 x86_64 和 ARM64（aarch64）架构。

{{</ notice >}}

### 节点要求

- 所有节点必须都能通过 `SSH` 访问。
- 所有节点时间同步。
- 所有节点都应使用 `sudo`/`curl`/`openssl`/`tar`。
- 若节点配备 NVIDIA GPU 或华为昇腾 NPU，请在创建集群前参考 [安装显卡驱动](../gpu-driver-installation/) 完成驱动与容器 runtime 配置。

### 容器运行时

集群使用 **containerd** 作为容器运行时，不再支持 Docker。如果您使用 KubeKey 搭建集群，KubeKey 会自动安装 containerd。

| 支持的容器运行时 | 版本 |
| ---------------- | ---- |
| containerd | 1.7+ |

{{< notice note >}}

离线部署时，containerd 已包含在离线安装包中，无需单独安装。

{{</ notice >}}

### 依赖项要求

KubeKey 可以一同安装 Kubernetes 和 Kube AI Hub。根据要安装的 Kubernetes 版本，需要安装的依赖项可能会不同。您可以参考下表，查看是否需要提前在节点上安装相关依赖项。

| 依赖项      | Kubernetes 版本 ≥ 1.28 |
| ----------- | ---------------------- |
| `socat`     | 必须                   |
| `conntrack` | 必须                   |
| `ebtables`  | 可选，但建议安装       |
| `ipset`     | 可选，但建议安装       |

### 网络和 DNS 要求

{{< content "common/network-requirements.md" >}}

{{< notice tip >}}

- 建议您使用干净的操作系统（即不安装任何其他软件）。否则，可能会产生冲突。
- 如果您从 `dockerhub.io` 下载镜像时遇到问题，建议提前准备仓库的镜像地址（即加速器）。

{{</ notice >}}

本示例包括以下三台主机，其中主节点充当任务机。

| 主机 IP     | 主机名 | 角色         |
| ----------- | ------ | ------------ |
| 192.168.0.2 | control plane | control plane, etcd |
| 192.168.0.3 | node1  | worker       |
| 192.168.0.4 | node2  | worker       |

## 步骤 2：获取 KubeKey

KubeKey 已包含在 Kube AI Hub 离线安装包中。解压离线包后，根据您的架构选择对应的二进制文件：

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

## 步骤 3：创建集群

对于多节点安装，您需要通过指定配置文件来创建集群。

### 1. 准备配置文件

离线包中包含示例配置文件。您需要准备两个文件：

- `inventory.yaml`：定义节点清单和角色分组
- `config.yaml`：定义集群参数（网络、存储、镜像仓库等）

以下是 `inventory.yaml` 示例：

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

- 根据实际节点 IP、主机名和架构（`amd64` 或 `arm64`）修改 `inventory.yaml`。
- `config.yaml` 中需配置镜像仓库存储路径等参数，请参考离线包中的示例文件。
- 安装 Kube AI Hub 3.4 的建议 Kubernetes 版本：v1.28.x 及以上，建议 v1.34.x。离线包默认安装 Kubernetes v1.34.4。

{{</ notice >}}

### 2. 创建集群

```bash
./kk create cluster -i inventory.yaml -c config.yaml
```

整个安装过程可能需要 10 到 20 分钟，具体取决于您的计算机和网络环境。

### 3. 验证安装

安装完成后，您会看到如下内容：

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

现在，您可以通过 `<NodeIP>:30880` 使用默认帐户和密码 (`admin/P@88w0rd`) 访问 Kube AI Hub 的 Web 控制台。

{{< notice note >}}

若要访问控制台，您可能需要根据您的环境配置端口转发规则。还请确保在您的安全组中打开了端口 `30880`。

{{</ notice >}}

## 启用 kubectl 自动补全

KubeKey 不会启用 kubectl 自动补全功能，请参见以下内容并将其打开：

{{< notice note >}}

请确保已安装 bash-autocompletion 并可以正常工作。

{{</ notice >}}

```bash
# Install bash-completion
apt-get install bash-completion

# Source the completion script in your ~/.bashrc file
echo 'source <(kubectl completion bash)' >>~/.bashrc

# Add the completion script to the /etc/bash_completion.d directory
kubectl completion bash >/etc/bash_completion.d/kubectl
```

详细信息[见此](https://kubernetes.io/docs/tasks/tools/install-kubectl/#enabling-shell-autocompletion)。
