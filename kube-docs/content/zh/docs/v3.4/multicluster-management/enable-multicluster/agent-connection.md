---
title: "代理连接"
keywords: 'Kubernetes, Kube AI Hub, 多集群, 代理连接'
description: '了解如何通过代理连接导入集群，以及概览页中的 agent.yaml 引导流程。'
linkTitle: "代理连接"
weight: 5220
---

Kube AI Hub 的组件 [Tower](https://github.com/kubesphere/tower) 用于代理连接。Tower 是一种通过代理在集群间建立网络连接的工具。如果主集群无法直接访问成员集群，您可以暴露主集群的代理服务地址，这样可以让成员集群通过代理连接到主集群。当成员集群部署在私有环境（例如 IDC）并且主集群可以暴露代理服务时，适用此连接方法。当您的集群分布部署在不同的云厂商上时，同样适用代理连接的方法。

要通过代理连接使用多集群功能，您必须拥有至少两个集群，分别用作主集群和成员集群。您可以在安装 Kube AI Hub 之前或者之后将一个集群指定为主集群或成员集群。有关安装 Kube AI Hub 的更多信息，请参考[在 Linux 上安装](../../../installing-on-linux/)和[在 Kubernetes 上安装](../../../installing-on-kubernetes/)。

![](/images/docs/v3.x/cluster-overview/agent-connection-flow.svg)

## 控制台中的代理连接引导

当您在控制台中创建成员集群并选择**代理连接**后，如果集群尚未成功加入，访问该集群的**概览**页会看到三步式引导：

1. 通过 SSH 登录成员集群并创建 `agent.yaml` 文件。
2. 将控制台生成的代理配置复制到 `agent.yaml` 中。
3. 在成员集群中执行 `kubectl create -f agent.yaml`，等待代理启动并上报状态。

{{< notice info >}}

概览页中的 `agent.yaml` 内容由主集群自动生成，您可以直接复制后部署到成员集群。

{{</ notice >}}

## 准备主集群

主集群为您提供中央控制平面，并且您只能指定一个主集群。

{{< tabs >}}

{{< tab "已经安装 Kube AI Hub" >}}

如果已经安装了独立的 Kube AI Hub 集群，您可以编辑集群配置，将 `clusterRole` 的值设置为 `host`。

- 选项 A - 使用 Web 控制台：

  使用 `admin` 帐户登录控制台，然后进入**集群管理**页面上的**定制资源定义**，输入关键字 `ClusterConfiguration`，然后转到其详情页面。编辑 `ks-installer` 的 YAML 文件，方法类似于[启用可插拔组件](../../../pluggable-components/)。

- 选项 B - 使用 Kubectl：

  ```shell
  kubectl edit cc ks-installer -n kubesphere-system
  ```

在 `ks-installer` 的 YAML 文件中，搜寻到 `multicluster`，将 `clusterRole` 的值设置为 `host`，然后点击**确定**（如果使用 Web 控制台）使其生效：

```yaml
multicluster:
  clusterRole: host
```

要设置主集群名称，请在 `ks-installer` 的 YAML 文件中的 `multicluster.clusterRole` 下添加 `hostClusterName` 字段：

```yaml
multicluster:
  clusterRole: host
  hostClusterName: <主集群名称>
```

{{< notice note >}}

- 建议您在准备主集群的同时设置主集群名称。若您的主集群已在运行并且已经部署过资源，不建议您再去设置主集群名称。
- 主集群名称只能包含小写字母、数字、连字符（-）或者半角句号（.），必须以小写字母或数字开头和结尾。

{{</ notice >}}

您需要**稍等片刻**待该更改生效。

{{</ tab >}}

{{< tab "尚未安装 Kube AI Hub" >}}

在 Linux 上或者在现有 Kubernetes 集群上安装 Kube AI Hub 之前，您可以定义一个主集群。如果您想[在 Linux 上安装 Kube AI Hub](../../../installing-on-linux/introduction/multioverview/#1-创建示例配置文件)，需要使用 `config-sample.yaml` 文件。如果您想[在现有 Kubernetes 集群上安装 Kube AI Hub](../../../installing-on-kubernetes/introduction/overview/#部署-kubesphere)，需要使用两个 YAML 文件，其中一个是 `cluster-configuration.yaml`。

要设置一个主集群，请在安装 Kube AI Hub 之前，将 `config-sample.yaml` 或 `cluster-configuration.yaml` 文件中对应的 `clusterRole` 的值修改为 `host`。

```yaml
multicluster:
  clusterRole: host
```

要设置主集群名称，请在 `config-sample.yaml` 或 `cluster-configuration.yaml` 文件中的 `multicluster.clusterRole` 下添加 `hostClusterName` 字段：

```yaml
multicluster:
  clusterRole: host
  hostClusterName: <主集群名称>
```

{{< notice note >}}

- 主集群名称只能包含小写字母、数字、连字符（-）或者半角句号（.），必须以小写字母或数字开头和结尾。

{{</ notice >}}

{{< notice info >}}

如果您在单节点集群上安装 Kube AI Hub ([All-in-One](../../../quick-start/all-in-one-on-linux/))，则不需要创建 `config-sample.yaml` 文件。这种情况下，您可以在安装 Kube AI Hub 之后设置主集群。

{{</ notice >}} 

{{</ tab >}}

{{</ tabs >}}

您可以使用 **kubectl** 来获取安装日志以验证状态。运行以下命令，稍等片刻，如果主集群已准备就绪，您将看到成功的日志返回。

```bash
kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
```

## 设置代理服务地址

安装主集群后，将在 `kubesphere-system` 中创建一个名为 `tower` 的代理服务，其类型为 `LoadBalancer`。

{{< tabs >}}

{{< tab "集群中有可用的 LoadBalancer" >}}

如果集群中有可用的 LoadBalancer 插件，则可以看到 Tower 服务有相应的 `EXTERNAL-IP` 地址，该地址将由 Kube AI Hub 自动获取并配置代理服务地址，这意味着您可以跳过设置代理服务地址这一步。执行以下命令确认是否有 LoadBalancer 插件。

```bash
kubectl -n kubesphere-system get svc
```

命令输出结果可能如下所示：

```shell
NAME       TYPE            CLUSTER-IP      EXTERNAL-IP     PORT(S)              AGE
tower      LoadBalancer    10.233.63.191   139.198.110.23  8080:30721/TCP       16h
```

{{< notice note >}}

一般来说，主流公有云厂商会提供 LoadBalancer 解决方案，并且负载均衡器可以自动分配外部 IP。如果您的集群运行在本地环境中，尤其是在**裸机环境**中，可以使用 [OpenELB](https://github.com/kubesphere/openelb) 作为负载均衡器解决方案。

{{</ notice >}}

{{</ tab >}}

{{< tab "集群中没有可用的 LoadBalancer" >}}

1. 执行以下命令来检查服务。

    ```shell
    kubectl -n kubesphere-system get svc
    ```

    命令输出结果可能如下所示。在此示例中，可以看出 `NodePort` 为 `30721`：
    ```
    NAME       TYPE            CLUSTER-IP      EXTERNAL-IP     PORT(S)              AGE
    tower      LoadBalancer    10.233.63.191   <pending>  8080:30721/TCP            16h
    ```

2. 由于 `EXTERNAL-IP` 处于 `pending` 状态，您需要手动设置代理地址。例如，如果您的公有 IP 地址为 `139.198.120.120`，则需要将公网 IP 的端口，如`30721` 转发到 `NodeIP`:`NodePort`。

3. 将 `proxyPublishAddress` 的值添加到 `ks-installer` 的配置文件中，并按如下所示输入公有 IP 地址（此处示例 `139.198.120.120`）和端口号。

    - 选项 A - 使用 Web 控制台：

      使用 `admin` 帐户登录控制台，然后进入**集群管理**页面上的**定制资源定义**，输入关键字 `ClusterConfiguration`，然后转到其详情页面。编辑 `ks-installer` 的 YAML 文件，方法类似于[启用可插拔组件](../../../pluggable-components/)。

    - 选项 B - 使用 Kubectl：

      ```bash
      kubectl -n kubesphere-system edit clusterconfiguration ks-installer
      ```

    搜寻到 `multicluster` 并添加新行输入 `proxyPublishAddress` 来定义 IP 地址，以便访问 Tower。

    ```yaml
    multicluster:
        clusterRole: host
        proxyPublishAddress: http://139.198.120.120:{NodePort} # Add this line to set the address to access tower
    ```
    请将 YAML 文件中的 {NodePort} 替换为您在步骤 2 中指定的端口。

4. 保存配置并稍等片刻，或者您可以运行以下命令手动重启 `ks-apiserver` 使修改立即生效。

    ```shell
    kubectl -n kubesphere-system rollout restart deployment ks-apiserver
    ```

{{</ tab >}}

{{</ tabs >}}

## 准备成员集群

为了通过**主集群**管理成员集群，您需要使它们之间的 `jwtSecret` 相同。因此，您首先需要在**主集群**中执行以下命令来获取它。

```bash
kubectl -n kubesphere-system get cm kubesphere-config -o yaml | grep -v "apiVersion" | grep jwtSecret
```

命令输出结果可能如下所示：

```yaml
jwtSecret: "gfIwilcc0WjNGKJ5DLeksf2JKfcLgTZU"
```

{{< tabs >}}

{{< tab "已经安装 Kube AI Hub" >}}

如果已经安装了独立的 Kube AI Hub 集群，您可以编辑集群配置，将 `clusterRole` 的值设置为 `member`。

- 选项 A - 使用 Web 控制台：

  使用 `admin` 帐户登录控制台，然后进入**集群管理**页面上的**定制资源定义**，输入关键字 `ClusterConfiguration`，然后转到其详情页面。编辑 `ks-installer` 的 YAML 文件，方法类似于[启用可插拔组件](../../../pluggable-components/)。

- 选项 B - 使用 Kubectl：

  ```shell
  kubectl edit cc ks-installer -n kubesphere-system
  ```

在 `ks-installer` 的 YAML 文件中对应输入上面所示的 `jwtSecret`：

```yaml
authentication:
  jwtSecret: gfIwilcc0WjNGKJ5DLeksf2JKfcLgTZU
```

向下滚动并将 `clusterRole` 的值设置为 `member`，然后点击**确定**（如果使用 Web 控制台）使其生效：

```yaml
multicluster:
  clusterRole: member
```

您需要**稍等片刻**待该更改生效。

{{</ tab >}}

{{< tab "尚未安装 Kube AI Hub" >}}

在 Linux 上或者在现有 Kubernetes 集群上安装 Kube AI Hub 之前，您可以定义成员集群。如果您想[在 Linux 上安装 Kube AI Hub](../../../installing-on-linux/introduction/multioverview/#1-创建示例配置文件)，需要使用 `config-sample.yaml` 文件。如果您想[在现有 Kubernetes 集群上安装 Kube AI Hub](../../../installing-on-kubernetes/introduction/overview/#部署-kubesphere)，需要使用两个 YAML 文件，其中一个是 `cluster-configuration.yaml`。要设置成员集群，请在安装 Kube AI Hub 之前，在 `config-sample.yaml` 或 `cluster-configuration.yaml` 文件中输入上方 `jwtSecret` 所对应的值，并将 `clusterRole` 的值修改为 `member`。

```yaml
authentication:
  jwtSecret: gfIwilcc0WjNGKJ5DLeksf2JKfcLgTZU
```

```yaml
multicluster:
  clusterRole: member
```

{{< notice note >}}

如果您在单节点集群上安装 Kube AI Hub ([All-in-One](../../../quick-start/all-in-one-on-linux/))，则不需要创建 `config-sample.yaml` 文件。这种情况下，您可以在安装 Kube AI Hub 之后设置成员集群。

{{</ notice >}} 

{{</ tab >}}

{{</ tabs >}}

您可以使用 **kubectl** 来获取安装日志以验证状态。运行以下命令，稍等片刻，如果成员集群已准备就绪，您将看到成功的日志返回。

```bash
kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
```

## 导入成员集群

1. 以 `admin` 身份登录 Kube AI Hub 控制台，转到**集群管理**页面点击**添加集群**。
   
2. 在**导入集群**页面输入要导入的集群的基本信息。您也可以点击右上角的**编辑模式**以 YAML 格式查看并编辑基本信息。编辑完成后，点击**下一步**。

3. 在**连接方式**中选择**代理连接**，然后点击**创建**。创建完成后，系统会进入该集群的概览页并显示 `agent.yaml` 引导内容。

4. 根据界面提示在成员集群中创建一个 `agent.yaml` 文件，然后将控制台中的代理部署配置复制并粘贴到该文件中。在成员集群中执行以下命令部署代理：

   ```bash
   kubectl create -f agent.yaml
   ```

5. 请确保成员集群能够访问主集群暴露出来的代理地址。待代理启动并运行后，概览页会自动切换为正常的集群仪表盘。
