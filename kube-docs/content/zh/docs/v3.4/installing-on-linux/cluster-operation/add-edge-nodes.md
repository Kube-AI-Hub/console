---
title: "添加边缘节点"
keywords: 'Kubernetes, Kube AI Hub, KubeEdge'
description: '将边缘节点添加到集群。'
linkTitle: "添加边缘节点"
weight: 3630
---

Kube AI Hub 利用 [KubeEdge](https://kubeedge.io/zh/) 将原生容器化应用程序编排功能扩展到边缘的主机。KubeEdge 拥有单独的云端和边端核心模块，提供完整的边缘计算解决方案，但安装过程可能较为繁琐。

![kubeedge_arch](/images/docs/v3.x/installing-on-linux/add-and-delete-nodes/add-edge-nodes/kubeedge-architecture-zh.svg)

{{< notice note >}}

有关 KubeEdge 不同组件的更多信息，请参见 [KubeEdge 文档](https://docs.kubeedge.io/zh/docs/kubeedge/#components)。

{{</ notice >}} 

本教程演示如何将边缘节点添加到集群。

## 准备工作

- 您需要启用 [KubeEdge](../../../pluggable-components/kubeedge/)。
- 为了避免兼容性问题，建议安装 v1.28.x 及以上版本的 Kubernetes。
- 您有一个可用节点作为边缘节点，该节点可以运行 Ubuntu（建议）或 CentOS。本教程以 Ubuntu 18.04 为例。
- 与 Kubernetes 集群节点不同，边缘节点应部署在单独的网络中。

## 防止非边缘工作负载调度到边缘节点

边缘节点带有污点 `node-role.kubernetes.io/edge:NoSchedule`，但 Calico、JuiceFS CSI、Weave Scope 等 DaemonSet 带有「容忍全部污点」。它们依赖集群内网和私有镜像仓库，调度到边缘节点后会一直处于 `CrashLoopBackOff` 或 `ImagePullBackOff`。

安装器已经让 JuiceFS CSI 与 Weave Scope 跳过带 `node-role.kubernetes.io/edge` 标签的节点。Calico 由 Tigera Installation 管理，需要在 `calico-node` DaemonSet 和 `calico-typha` Deployment 上设置同样的节点亲和性：节点不存在标签 `node-role.kubernetes.io/edge`。`node-exporter` 的主 DaemonSet 也使用这条规则；边缘节点的主机指标由下文的 `node-exporter-edge` 单独采集。

## 创建防火墙规则和端口转发规则

边缘节点上的 `keadm join` 会连接 `advertiseAddress` 上的 CloudHub 端口，而不是 NodePort。默认对应关系如下。`ClusterConfiguration` 里如果改过 `cloudhubNodePort` 等字段，内网端口以配置为准，加入命令里的 `--cloudcore-ipport`、`--certport`、`--tunnelport` 必须指向边缘节点实际能连上的地址和端口。

边缘节点与主集群不在同一网络时，把下表的内网 NodePort 转发到边缘节点能访问的地址，并让加入命令使用转发后的地址。EdgeMesh 的中继端口 `20006` 也要能从边缘节点连到中继节点，否则只能注册节点，采集不到 CPU、内存和磁盘。

若要确保边缘节点可以成功地与集群通信，您必须转发端口，以便外部流量进入您的网络。您可以根据下表将外网端口映射到相应的内网 IP 地址（主节点）和端口。此外，您还需要创建防火墙规则以允许流量进入这些端口（`10000` 至 `10004`，以及 EdgeMesh 的 `20006`）。

   {{< notice note >}}
   `advertiseAddress` 上的 `10000`–`10004` 已经能从边缘节点访问时，不必再做转发。只开放了 NodePort 时，把 NodePort 转到 `10000`–`10004`，或把加入命令里的端口改成实际开放的 NodePort。
   {{</ notice >}} 

| 字段                | 外网端口 | 字段                    | 内网端口 |
| ------------------- | -------- | ----------------------- | -------- |
| `cloudhubPort`      | `10000`  | `cloudhubNodePort`      | `30000`  |
| `cloudhubQuicPort`  | `10001`  | `cloudhubQuicNodePort`  | `30001`  |
| `cloudhubHttpsPort` | `10002`  | `cloudhubHttpsNodePort` | `30002`  |
| `cloudstreamPort`   | `10003`  | `cloudstreamNodePort`   | `30003`  |
| `tunnelPort`        | `10004`  | `tunnelNodePort`        | `30004`  |
| EdgeMesh 中继       | `20006`  | 中继节点本机监听        | `20006`  |

## 配置边缘节点

您需要在边缘节点上安装容器运行时并配置 EdgeMesh。

### 安装容器运行时

[KubeEdge](https://docs.kubeedge.io/zh/docs/) 支持多种容器运行时，包括 Docker、containerd、CRI-O 和 Virtlet。有关更多信息，请参见 [KubeEdge 文档](https://docs.kubeedge.io/zh/docs/advanced/cri/)。

{{< notice note >}}

KubeEdge 1.13 的 `keadm join` 默认通过 CRI v1alpha2 连接 containerd。containerd 2.x 不再提供该接口，加入会报 `unknown service runtime.v1alpha2.ImageService`。这种节点请安装 Docker，并在控制台生成的命令末尾加上 `--runtimetype=docker --cgroupdriver=systemd`。

{{</ notice >}}

### 配置 EdgeMesh

执行以下步骤以在边缘节点上配置 [EdgeMesh](https://kubeedge.io/zh/docs/advanced/edgemesh/)。

1. 编辑 `/etc/nsswitch.conf`。

   ```bash
   vi /etc/nsswitch.conf
   ```

2. 在该文件中添加以下内容。

   ```bash
   hosts:          dns files mdns4_minimal [NOTFOUND=return]
   ```

3. 保存文件并运行以下命令启用 IP 转发：

   ```bash
   sudo echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
   ```

4. 验证修改：

   ```bash
   sudo sysctl -p | grep ip_forward
   ```

   预期结果：

   ```bash
   net.ipv4.ip_forward = 1
   ```

## 添加边缘节点

1. 使用 `admin` 用户登录控制台，点击左上角的**平台管理**。

2. 选择**集群管理**，然后导航至**节点**下的**边缘节点**。

   {{< notice note >}}

   如果已经启用[多集群管理](../../../multicluster-management/)，则需要首先选择一个集群。

   {{</ notice >}} 

3. 点击**添加**。在出现的对话框中，设置边缘节点的节点名称并输入其内网 IP 地址。点击**验证**以继续。
   
   ![add-edge-node](/images/docs/v3.x/zh-cn/installing-on-linux/add-and-delete-nodes/add-edge-nodes/add-edge-node.png)

   {{< notice note >}} 

   - 内网 IP 地址仅用于节点间通信，您不一定要使用边缘节点的真实内网 IP 地址。只要 IP 地址验证成功，您就可以使用该 IP 地址。
   - 建议您勾选方框添加默认污点。

   {{</ notice >}} 

4. 复制**边缘节点配置命令**下自动创建的命令，并在您的边缘节点上运行该命令。

   ![edge-command](/images/docs/v3.x/zh-cn/installing-on-linux/add-and-delete-nodes/add-edge-nodes/edge-command.png)

   {{< notice note >}}

   在运行该命令前，请确保您的边缘节点上已安装 `wget`。

   {{</ notice >}} 

5. 关闭对话框，刷新页面，您将看到边缘节点显示在列表中。

   {{< notice note >}}

   列表和状态页上的 CPU、内存、磁盘曲线来自 Prometheus 中的 node-exporter，不是 Metrics Server。只安装 Metrics Server 时，这些曲线仍为空。容器组占用率来自 kube-state-metrics，节点 Ready 后就能显示。

   {{</ notice >}}


## 启用边缘节点资源监控

状态页路径为 `/clusters/<cluster>/edgenodes/<node>/status`。页面查询 `node_cpu_utilisation`、`node_memory_utilisation` 和 `node_disk_size_utilisation`。这三条记录规则读取 `job="node-exporter"` 的序列，再按 Pod 关联出节点名。

主集群的 `node-exporter` DaemonSet 明确跳过边缘节点，Prometheus 也拨不到边缘节点的内网地址。要让状态页出现这三条曲线，需要在边缘节点上跑一份 node-exporter，并用 EdgeMesh 把云上的抓取转发过去。

### 1. 打开 edgecore 的 metaServer

EdgeMesh 在边缘节点上以 EdgeMode 运行，通过本机 metaServer 读取 Service，而不是直接访问云上的 API。`keadm join` 生成的配置里 metaServer 默认关闭。

编辑 `/etc/kubeedge/config/edgecore.yaml`：

```yaml
metaManager:
  enable: true
  metaServer:
    enable: true
    server: 127.0.0.1:10550
```

然后重启并确认端口：

```bash
systemctl restart edgecore
ss -lnt | grep 10550
```

同时确认 `edgeStream` 已按下一节打开。没有这条隧道时，容器日志和终端都会一直转圈。

### 查看容器日志和打开终端

控制台查看边缘 Pod 日志、打开容器终端，走的是 KubeEdge 的 CloudStream / edgeStream，不是节点 IP 上的 kubelet `10250`。云上在 `ClusterConfiguration` 里打开 `edgeruntime.kubeedge.cloudCore.cloudStream.enable`（默认即为 `true`）。每个边缘节点还要在 `/etc/kubeedge/config/edgecore.yaml` 里打开边端：

```yaml
edgeStream:
  enable: true
  server: <边缘节点能访问的地址>:10004
```

`server` 默认是 `advertiseAddress:10004`。只发布了 NodePort 时，改成对应的 `tunnelNodePort`，或把该 NodePort 转发到边缘节点用来连接的 `10004`。改完后执行 `systemctl restart edgecore`。

验证：

```bash
kubectl -n <namespace> logs <pod> --tail=20
```

命令能返回容器输出，即隧道已通。镜像里没有 shell（例如 `prom/node-exporter`）时，终端会报找不到可执行文件，这是镜像本身的限制，不是隧道失败。

### 2. 安装 EdgeMesh

在云上安装与 CloudCore 相同大版本的 EdgeMesh（KubeEdge 1.13 使用 `kubeedge/edgemesh-agent:v1.13.5`）。Agent 使用 `hostNetwork`，并容忍全部污点，这样边缘节点也能跑。

只代理打了标签的 Service，避免 EdgeMesh 接管集群里其他 ClusterIP：

```yaml
agent:
  image: kubeedge/edgemesh-agent:v1.13.5
  tolerations:
    - operator: Exists
  psk: <openssl rand -base64 32 的结果>
  relayNodes:
    - nodeName: <云上中继节点名>
      advertiseAddress:
        - <边缘节点能访问的中继地址>
  modules:
    edgeProxy:
      enable: true
      serviceFilterMode: FilterIfLabelDoesNotExists
    edgeTunnel:
      enable: true
      listenPort: 20006
```

`serviceFilterMode` 的取值是 `FilterIfLabelDoesNotExists`，不要写成带 `Mode` 后缀的形式，否则 Agent 会启动失败。

EdgeMesh 不会在名称以 `br`、`docker`、`tunl`、`flannel`、`cni` 开头的网卡上监听。节点地址如果落在 `br0` 这类网桥上，需要把该地址的 `20006` 转发到 Agent 实际监听的 `127.0.0.1:20006`，并把转发后的地址写进 `advertiseAddress`。

边缘节点加入成功后，Agent 日志里应出现 `success bootstrapped`。

### 3. 部署边缘 node-exporter

应用安装器清单 `ks-installer/roles/ks-monitor/files/prometheus/node-exporter/node-exporter-edge.yaml`。它只调度到带 `node-role.kubernetes.io/edge` 标签的节点，使用多架构镜像 `docker.io/prom/node-exporter:v1.12.1`，在 `9100` 上提供 HTTP 指标。

对应的 Service 必须是普通 ClusterIP，不能是 headless。EdgeMesh 不代理 headless Service。Service 上的两个标签都要保留：

- `service.edgemesh.kubeedge.io/service-proxy-name`：让 EdgeMesh 代理这个 Service。
- `service.kubernetes.io/service-proxy-name: edgemesh`：让 kube-proxy 不要再把 ClusterIP 转到边缘节点的内网地址。

部署后，在云节点上访问该 ClusterIP 的 `/metrics` 应返回 `200`。如果超时，先看 EdgeMesh 是否已与中继建立连接，再看 kube-proxy 是否仍占用这个 Service。

### 4. 让 Prometheus 抓取 ClusterIP

现有的 node-exporter ServiceMonitor 按 Endpoints 地址抓取。边缘节点的 Endpoints 地址从云上不可达，必须改抓 EdgeMesh 代理的 ClusterIP，同时保留 `namespace`、`pod`、`node` 标签，并把 `job` 写成 `node-exporter`，记录规则才能关联到节点。

把下面的作业追加到 Prometheus 的 `additionalScrapeConfigs`：

```yaml
- job_name: node-exporter-edge
  scrape_interval: 30s
  scrape_timeout: 10s
  metrics_path: /metrics
  scheme: http
  kubernetes_sd_configs:
    - role: pod
  relabel_configs:
    - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
      regex: node-exporter-edge
      action: keep
    - source_labels: [__meta_kubernetes_namespace]
      target_label: namespace
    - source_labels: [__meta_kubernetes_pod_name]
      target_label: pod
    - source_labels: [__meta_kubernetes_pod_node_name]
      target_label: node
    - target_label: __address__
      replacement: node-exporter-edge.kubesphere-monitoring-system.svc.cluster.local:9100
    - target_label: job
      replacement: node-exporter
```

Prometheus 重新加载配置后，目标 `node-exporter-edge` 应为 `up`。再用监控接口确认状态页用到的三条指标：

```bash
# resources_filter 换成边缘节点名
curl -H "Authorization: Bearer $TOKEN" \
  "$APISERVER/kapis/monitoring.kubesphere.io/v1alpha3/nodes?resources_filter=<edgenode>$&metrics_filter=node_cpu_utilisation|node_memory_utilisation|node_disk_size_utilisation$"
```

三条结果都有序列后，打开 `/clusters/<cluster>/edgenodes/<node>/status` 即可看到 CPU、内存和磁盘曲线。记录规则约每分钟计算一次，刚接入时曲线只有最近几个点。 
## 移除边缘节点

移除边缘节点之前，请删除在该节点上运行的全部工作负载。

1. 在边缘节点上运行以下命令：

   ```bash
   ./keadm reset
   ```

   ```
   apt remove mosquitto
   ```

   ```bash
   rm -rf /var/lib/kubeedge /var/lib/edged /etc/kubeedge/ca /etc/kubeedge/certs
   ```

   {{< notice note >}}

   如果无法删除 tmpfs 挂载的文件夹，请重启节点或先取消挂载该文件夹。

   {{</ notice >}} 

2. 运行以下命令从集群中移除边缘节点：

   ```bash
   kubectl delete node <edgenode-name>
   ```

3. 如需从集群中卸载 KubeEdge，运行以下命令：

   ```bash
   helm uninstall kubeedge -n kubeedge
   ```
   
   ```bash
   kubectl delete ns kubeedge
   ```
   
   {{< notice note >}}
   
   卸载完成后，您将无法为集群添加边缘节点。
   
   {{</ notice >}} 