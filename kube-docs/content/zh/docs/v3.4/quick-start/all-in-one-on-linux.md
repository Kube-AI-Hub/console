---
title: "在 Linux 上以 All-in-One 模式安装 Kube AI Hub"
keywords: 'Kube AI Hub, Kubernetes, All-in-One, 安装'
description: '了解在 Linux 上如何使用最小安装包安装 Kube AI Hub。本教程为您理解容器平台提供了基础入门知识，为学习以下指南奠定基础。'
linkTitle: "在 Linux 上以 All-in-One 模式安装 Kube AI Hub"
weight: 2100
---

对于刚接触 Kube AI Hub 并想快速上手该[容器平台](https://kubesphere.io/)的用户，All-in-One 安装模式是最佳的选择，它能够帮助您零配置快速部署 Kube AI Hub 和 Kubernetes。

## 步骤 1：准备 Linux 机器

若要以 All-in-One 模式进行安装，您仅需参考以下对机器硬件和操作系统的要求准备一台主机。

### 硬件推荐配置

<table>
  <tbody>
    <tr>
    <th width='320'>操作系统</th>
    <th>最低配置</th>
    </tr>
    <tr>
      <td><b>Ubuntu</b> <i>22.04</i>, <i>24.04</i>（建议 24.04 及以上）</td>
      <td>2 核 CPU，4 GB 内存，40 GB 磁盘空间</td>
    </tr>
    <tr>
      <td><b>CentOS</b> <i>9</i> 及以上</td>
      <td>2 核 CPU，4 GB 内存，40 GB 磁盘空间</td>
    </tr>
    <tr>
      <td><b>麒麟 Kylin</b> <i>V10</i></td>
      <td>2 核 CPU，4 GB 内存，40 GB 磁盘空间</td>
    </tr>
    <tr>
      <td><b>openEuler</b> <i>22.03 LTS</i> 及以上</td>
      <td>2 核 CPU，4 GB 内存，40 GB 磁盘空间</td>
    </tr>
  </tbody>
</table>

{{< notice note >}}

以上的系统要求和以下的教程适用于没有启用任何可选组件的默认最小化安装。如果您的机器至少有 8 核 CPU 和 16 GB 内存，则建议启用所有组件。有关更多信息，请参见[启用可插拔组件](../../pluggable-components/)。

{{</ notice >}}

### 节点要求

- 节点必须能够通过 `SSH` 连接。
- 节点上可以使用 `sudo`/`curl`/`openssl`/`tar` 命令。

### 容器运行时

集群使用 **containerd** 作为容器运行时，不再支持 Docker。如果您使用 KubeKey 搭建集群，KubeKey 会自动安装 containerd。

<table>
  <tbody>
    <tr>
      <th width='500'>支持的容器运行时</th>
      <th>版本</th>
    </tr>
    <tr>
      <td>containerd</td>
      <td>1.7+</td>
    </tr>
  </tbody>
</table>

### 依赖项要求

KubeKey 可以将 Kubernetes 和 Kube AI Hub 一同安装。根据要安装的 Kubernetes 版本，需要安装的依赖项可能会不同。您可以参考以下列表，查看是否需要提前在节点上安装相关的依赖项。

<table>
  <tbody>
    <tr>
      <th>依赖项</th>
     <th>Kubernetes 版本 ≥ 1.28</th>
    </tr>
    <tr>
      <td><code>socat</code></td>
     <td>必须</td> 
    </tr>
    <tr>
      <td><code>conntrack</code></td>
     <td>必须</td> 
    </tr>
    <tr>
      <td><code>ebtables</code></td>
     <td>可选但建议</td> 
    </tr>
    <tr>
      <td><code>ipset</code></td>
     <td>可选但建议</td> 
    </tr>
  </tbody>
</table>

{{< notice info >}}

KubeKey 是用 Go 语言开发的一款全新的安装工具，代替了以前基于 ansible 的安装程序。KubeKey 为用户提供了灵活的安装选择，可以分别安装 Kube AI Hub 和 Kubernetes 或二者同时安装，既方便又高效。

{{</ notice >}}

### 网络和 DNS 要求

{{< content "common/network-requirements.md" >}}

{{< notice tip >}}

- 建议您的操作系统处于干净状态（不安装任何其他软件），否则可能会发生冲突。
- 如果您无法从 `dockerhub.io` 下载容器镜像，建议提前准备仓库的镜像地址（即加速器）。

{{</ notice >}}

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

## 步骤 3：开始安装

在本快速入门教程中，您只需执行一个命令即可进行安装：

```bash
./kk create cluster -i inventory.yaml -c config.yaml
```

{{< notice note >}}

- 离线包中包含示例 `inventory.yaml` 和 `config.yaml` 文件。All-in-One 安装只需将单个节点同时配置为 control plane 和 worker 角色。
- 安装 Kube AI Hub 3.4 的建议 Kubernetes 版本：v1.28.x 及以上，建议 v1.34.x。离线包默认安装 Kubernetes v1.34.4。
- KubeKey 会默认安装 [OpenEBS](https://openebs.io/) 为开发和测试环境提供 LocalPV 以方便新用户。对于其他存储类型，请参见[持久化存储配置](../../installing-on-linux/persistent-storage-configurations/understand-persistent-storage/)。

{{</ notice >}}

执行该命令后，KubeKey 将检查您的安装环境，结果显示在一张表格中。有关详细信息，请参见[节点要求](#节点要求)和[依赖项要求](#依赖项要求)。输入 `yes` 继续安装流程。

## 步骤 4：验证安装结果

输入以下命令以检查安装结果。

```bash
kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
```

输出信息会显示 Web 控制台的 IP 地址和端口号，默认的 NodePort 是 `30880`。现在，您可以使用默认的帐户和密码 (`admin/P@88w0rd`) 通过 `<NodeIP>:30880` 访问控制台。

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
     "Cluster Management". If any service is not
     ready, please wait patiently until all components 
     are up and running.
  2. Please change the default password after login.

#####################################################
```

{{< notice note >}}

您可能需要配置端口转发规则并在安全组中开放端口，以便外部用户访问控制台。

{{</ notice >}}

登录至控制台后，您可以在**系统组件**中查看各个组件的状态。如果要使用相关服务，您可能需要等待部分组件启动并运行。您也可以使用 `kubectl get pod --all-namespaces` 来检查 Kube AI Hub 相关组件的运行状况。

## 启用可插拔组件（可选）

本指南仅适用于默认的最小化安装。若要在 Kube AI Hub 中启用其他组件，请参见[启用可插拔组件](../../pluggable-components/)。
