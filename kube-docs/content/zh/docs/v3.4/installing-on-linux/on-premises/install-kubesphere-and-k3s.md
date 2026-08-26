---
title: "部署 K3s 和 Kube AI Hub"
keywords: 'Kubernetes, Kube AI Hub, K3s'
description: '了解如何使用 KubeKey 安装 K3s 和 Kube AI Hub。'
linkTitle: "部署 K3s 和 Kube AI Hub"
weight: 3530
---

[K3s](https://www.rancher.cn/k3s/) 是专为物联网和边缘计算打造的轻量级 Kubernetes 发行版，最大程度上剔除了外部依赖项。它打包为单个二进制文件，减少了搭建 Kubernetes 集群所需的依赖项和步骤。

您可以使用 KubeKey 同时安装 K3s 和 Kube AI Hub，也可以将 Kube AI Hub 部署在现有的 K3s 集群上。

{{< notice note >}}

目前，由于功能尚未充分测试，在 K3s 上部署 Kube AI Hub 仅用于测试和开发。

{{</ notice >}}

## 准备工作

- 有关安装 K3s 的准备工作的更多信息，请参阅 [K3s 文档](https://docs.rancher.cn/docs/k3s/installation/installation-requirements/_index)。
- 取决于您的网络环境，您可能需要配置防火墙规则和端口转发规则。有关更多信息，请参见[端口要求](../../../installing-on-linux/introduction/port-firewall/)。

## 步骤 1：获取 KubeKey

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

## 步骤 2：创建集群

1. 执行以下命令为集群创建一个配置文件：

   ```bash
   ./kk create config --with-kubernetes v1.34.4-k3s --with-kubesphere v3.4.1
   ```

   {{< notice note >}}

   - KubeKey 支持安装 K3s v1.34.4。

   - 您可以在以上命令中使用 `-f` 或 `--file` 参数指定配置文件的路径和名称。如未指定路径和名称，KubeKey 将默认在当前目录下创建 `config-sample.yaml` 配置文件。

   {{</ notice >}}

2. 执行以下命令编辑配置文件（以下以默认配置文件名为例）：

   ```bash
   vi config-sample.yaml
   ```

   ```yaml
   ...
   metadata:
     name: sample
   spec:
     hosts:
     - {name: master, address: 192.168.0.2, internalAddress: 192.168.0.2, user: ubuntu, password: Testing123}
     - {name: node1, address: 192.168.0.3, internalAddress: 192.168.0.3, user: ubuntu, password: Testing123}
     - {name: node2, address: 192.168.0.4, internalAddress: 192.168.0.4, user: ubuntu, password: Testing123}
     roleGroups:
       etcd:
       - master
       control-plane:
       - master
       worker:
       - node1
       - node2
     controlPlaneEndpoint:
       domain: lb.kubesphere.local
       address: ""
       port: 6443
     kubernetes:
       version: v1.34.4-k3s
       imageRepo: kubesphere
       clusterName: cluster.local
     network:
       plugin: calico
       kubePodsCIDR: 10.233.64.0/18
       kubeServiceCIDR: 10.233.0.0/18
     registry:
       registryMirrors: []
       insecureRegistries: []
     addons: []
   ...
   ```

3. 保存文件并执行以下命令安装 K3s 和 Kube AI Hub：

   ```
   ./kk create cluster -f config-sample.yaml
   ```

4. 安装完成后，可运行以下命令查看安装日志：

   ```bash
   kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
   ```

   如果显示如下信息则安装成功：

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

5. 从安装日志的 `Console`、`Account` 和 `Password` 参数分别获取 Kube AI Hub Web 控制台的地址、系统管理员用户名和系统管理员密码，并使用 Web 浏览器登录 Kube AI Hub Web 控制台。

   {{< notice note >}}

   您可以在安装后启用 Kube AI Hub 的可插拔组件，但由于在 K3s 上部署 Kube AI Hub 目前处于测试阶段，某些功能可能不兼容。
   
   {{</ notice >}}
