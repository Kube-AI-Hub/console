---
title: "使用负载均衡器创建高可用集群"
keywords: 'Kube AI Hub, Kubernetes, HA, 高可用, 安装, 配置'
description: '如何配置一个高可用 Kubernetes 集群。'
linkTitle: "使用负载均衡器创建高可用集群"
weight: 3150
---

您可以根据教程[多节点安装](../../../installing-on-linux/introduction/multioverview/)来创建单主节点 Kubernetes 集群并安装 Kube AI Hub。大多数情况下，单主节点集群大致足以供开发和测试环境使用。但是，对于生产环境，您需要考虑集群的高可用性。如果关键组件（例如 kube-apiserver、kube-scheduler 和 kube-controller-manager）都在同一个主节点上运行，一旦主节点宕机，Kubernetes 和 Kube AI Hub 都将不可用。因此，您需要为多个主节点配置负载均衡器，以创建高可用集群。您可以使用任意云负载均衡器或者任意硬件负载均衡器（例如 F5）。此外，也可以使用 Keepalived 和 [HAproxy](https://www.haproxy.com/)，或者 Nginx 来创建高可用集群。

本教程演示了在 Linux 上安装 Kube AI Hub 时，高可用集群的大体配置。

## 架构

在您开始操作前，请确保准备了 6 台 Linux 机器，其中 3 台充当主节点，另外 3 台充当工作节点。下图展示了推荐的高可用布局。有关系统和网络要求的更多信息，请参见[多节点安装](../../../installing-on-linux/introduction/multioverview/#步骤1准备-linux-主机)。

![高可用架构](/images/docs/v3.x/installing-on-linux/high-availability-configurations/ha-architecture-zh.svg)

## 配置负载均衡器

您必须在您的环境中创建一个负载均衡器来监听（在某些云平台也称作监听器）关键端口。建议监听下表中的端口。

| 服务       | 协议 | 端口  |
| ---------- | ---- | ----- |
| apiserver  | TCP  | 6443  |
| ks-console | TCP  | 30880 |
| http       | TCP  | 80    |
| https      | TCP  | 443   |

{{< notice note >}}

- 请确保您的负载均衡器至少监听 apiserver 端口。

- 根据集群的部署位置，您可能需要在安全组中打开端口以确保外部流量不被屏蔽。有关更多信息，请参见[端口要求](../../../installing-on-linux/introduction/port-firewall/)。
- 在一些云平台上，您可以同时配置内置负载均衡器和外置负载均衡器。为外置负载均衡器分配公共 IP 地址后，您可以使用该 IP 地址来访问集群。
- 有关如何配置负载均衡器的更多信息，请参见“在公有云上安装”中对在主要公有云平台上具体操作步骤的说明。

{{</ notice >}} 

## 获取 KubeKey

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

创建包含默认配置的示例配置文件。这里使用 Kubernetes v1.34.4 作为示例。

```bash
./kk create config --with-kubesphere v3.4.1 --with-kubernetes v1.34.4
```

{{< notice note >}}

- 安装 Kube AI Hub 3.4 的建议 Kubernetes 版本：v1.28.x、v1.29.x、v1.30.x、v1.31.x、v1.32.x、v1.33.x 和 v1.34.x（建议 v1.34.x）。如果不指定 Kubernetes 版本，KubeKey 将默认安装 Kubernetes v1.34.4。有关受支持的 Kubernetes 版本的更多信息，请参见[支持矩阵](../../../installing-on-linux/introduction/kubekey/#支持矩阵)。

- 如果您在这一步的命令中不添加标志 `--with-kubesphere`，则不会部署 Kube AI Hub，只能使用配置文件中的 `addons` 字段安装，或者在您后续使用 `./kk create cluster` 命令时再次添加这个标志。

- 如果您添加标志 `--with-kubesphere` 时不指定 Kube AI Hub 版本，则会安装最新版本的 Kube AI Hub。

{{</ notice >}}

## 部署 Kube AI Hub 和 Kubernetes

运行以上命令后，会创建一个配置文件 `config-sample.yaml`。编辑该文件以添加机器信息、配置负载均衡器和其他内容。

{{< notice note >}}

如果您自定义文件名，文件名称可能会不同。

{{</ notice >}} 

### config-sample.yaml 示例

```yaml
spec:
  hosts:
  - {name: master1, address: 192.168.0.2, internalAddress: 192.168.0.2, user: ubuntu, password: Testing123}
  - {name: master2, address: 192.168.0.3, internalAddress: 192.168.0.3, user: ubuntu, password: Testing123}
  - {name: master3, address: 192.168.0.4, internalAddress: 192.168.0.4, user: ubuntu, password: Testing123}
  - {name: node1, address: 192.168.0.5, internalAddress: 192.168.0.5, user: ubuntu, password: Testing123}
  - {name: node2, address: 192.168.0.6, internalAddress: 192.168.0.6, user: ubuntu, password: Testing123}
  - {name: node3, address: 192.168.0.7, internalAddress: 192.168.0.7, user: ubuntu, password: Testing123}
  roleGroups:
    etcd:
    - master1
    - master2
    - master3
    control-plane:
    - master1
    - master2
    - master3
    worker:
    - node1
    - node2
    - node3
```

有关该配置文件中不同字段的更多信息，请参见 [Kubernetes 集群配置](../../../installing-on-linux/introduction/vars/)和[多节点安装](../../../installing-on-linux/introduction/multioverview/#2-编辑配置文件)。

### 配置负载均衡器

```yaml
spec:
  controlPlaneEndpoint:
    ##Internal loadbalancer for apiservers
    #internalLoadbalancer: haproxy
    
    domain: lb.kubesphere.local
    address: "192.168.0.xx"
    port: 6443
```

{{< notice note >}}

- `config-sample.yaml` 文件中的 `address` 和 `port` 应缩进两个空格。
- 大多数情况下，您需要在负载均衡器的 `address` 字段中提供**私有 IP 地址**。但是，不同的云厂商可能对负载均衡器有不同的配置。例如，如果您在阿里云上配置服务器负载均衡器 (SLB)，平台会为 SLB 分配一个公共 IP 地址，所以您需要在 `address` 字段中指定公共 IP 地址。
- 负载均衡器默认的内部访问域名是 `lb.kubesphere.local`。
- 若要使用内置负载均衡器，请将 `internalLoadbalancer` 字段取消注释。

{{</ notice >}}

### 持久化存储插件配置

在生产环境中，您需要准备持久化存储并在 `config-sample.yaml` 中配置存储插件（例如 CSI），以明确您想使用哪一种存储服务。有关更多信息，请参见[持久化存储配置](../../../installing-on-linux/persistent-storage-configurations/understand-persistent-storage/)。

### 启用可插拔组件（可选）

自 v2.1.0 起，Kube AI Hub 解耦了一些核心功能组件。您可以在安装之前或者之后启用这些可插拔组件。如果您不启用这些组件，Kube AI Hub 将默认以最小化安装。

您可以根据您的需求来启用任意可插拔组件。强烈建议您安装这些可插拔组件，以便体验 Kube AI Hub 提供的全栈特性和功能。启用前，请确保您的机器有足够的 CPU 和内存。有关详情请参见[启用可插拔组件](../../../pluggable-components/)。

### 开始安装

配置完成后，您可以执行以下命令来开始安装：

```bash
./kk create cluster -f config-sample.yaml
```

### 验证安装

1. 运行以下命令查看安装日志。

   ```bash
   kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
   ```

2. 若您看到以下信息，您的高可用集群便已创建成功。

   ```bash
   #####################################################
   ###              Welcome to Kube AI Hub!           ###
   #####################################################
   
   Console: http://192.168.0.3:30880
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
   https://www.watering.ai/          2020-xx-xx xx:xx:xx
   #####################################################
   ```
