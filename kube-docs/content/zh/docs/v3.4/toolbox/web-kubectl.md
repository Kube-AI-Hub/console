---
title: "Web Kubectl"
keywords: 'Kube AI Hub, Kubernetes, kubectl, cli'
description: 'Kube AI Hub 中集成了 Web Kubectl 工具，为 Kubernetes 用户提供一致的用户体验。'
linkTitle: "Web Kubectl"
weight: 15500
---

Kubectl 是 Kubernetes 命令行工具，您可以用它在 Kubernetes 集群上运行命令。Kubectl 可用于部署应用、查看和管理集群资源、查看日志等。

Kube AI Hub 控制台提供 Web Kubectl，方便用户使用。在默认情况下，当前版本中只有被授予 `platform-admin` 角色的用户（例如默认帐户 `admin`）才有权限使用 Web Kubectl 进行集群资源操作和管理。

本教程演示了如何使用 Web Kubectl 进行集群资源操作和管理。

![](/images/docs/v3.x/cluster-overview/tools-access.svg)

## 使用 Web Kubectl

1. 使用被授予 `platform-admin` 角色的用户登录 Kube AI Hub。

2. 进入**平台管理** > **集群管理**，打开目标集群的**概览**页。

3. 在**工具**卡片中点击 **kubectl**。

4. 系统会在新窗口中打开 Web Kubectl 终端。如果您启用了多集群功能，终端会直接面向当前集群打开，无需额外切换。

5. 在命令行工具中输入 Kubectl 命令，查询并管理 Kubernetes 集群资源。例如，执行以下命令查询集群中所有 PVC 的状态。

    ```bash
    kubectl get pvc --all-namespaces
    ```

6. 在终端窗口中使用以下语法运行 Kubectl 命令：

    ```bash
    kubectl [command] [TYPE] [NAME] [flags]
    ```

    {{< notice note >}}

- 其中，`command`、`TYPE`、`NAME` 和 `flags` 分别是：
  - `command`：指定要对一个或多个资源执行的操作，例如 `create`、`get`、`describe` 和 `delete`。
  - `TYPE`：指定[资源类型](https://kubernetes.io/zh/docs/reference/kubectl/overview/)。资源类型不区分大小写，您可以指定单数、复数或缩写形式。
  - `NAME`：指定资源的名称。名称区分大小写。如果省略名称，则会显示所有资源的详细信息，例如 `kubectl get pods`。
  - `flags`：指定可选标志。例如，您可以使用 `-s` 或 `--server` 标志指定 Kubernetes API 服务器的地址和端口。
- 如果您需要帮助，请在终端窗口运行 `kubectl help` 或者参考 [Kubernetes Kubectl CLI 文档](https://kubernetes.io/zh/docs/reference/kubectl/overview/)。

    {{</ notice >}}
