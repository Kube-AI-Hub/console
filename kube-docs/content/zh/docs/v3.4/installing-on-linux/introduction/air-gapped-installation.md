---
title: "离线安装"
keywords: '离线安装, 安装, Kube AI Hub'
description: '了解如何在离线环境中使用 KubeKey 安装 Kubernetes 和 Kube AI Hub。'
linkTitle: "离线安装"
weight: 3140
---

您可以使用 Kube AI Hub 离线安装包在离线环境中安装 Kubernetes 和 Kube AI Hub。离线安装包已包含 Kubernetes、containerd、镜像仓库及所有必需组件，无需访问外网。

## 准备工作

1. 从交付渠道获取 Kube AI Hub 离线安装包（通常为 `.tar.gz` 或 `.tar` 格式）。

2. 将离线包上传至目标节点并解压：

   ```bash
   tar -xzf kube-ai-hub-offline-<version>.tar.gz
   cd kube-ai-hub-offline-<version>
   ```

3. 根据您的架构选择 KubeKey 二进制文件：

   ```bash
   # x86_64 架构
   mv kk-x86 kk

   # ARM64 架构
   mv kk-arm kk

   chmod +x kk
   ```

## 步骤 1：配置主机清单

编辑 `inventory.yaml`，定义集群节点和角色分组：

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

- 根据实际节点 IP、主机名和架构（`amd64` 或 `arm64`）修改配置。
- 如果使用密码认证，将 `private_key` 替换为 `password: <password>`。
- `image_registry` 组指定镜像仓库节点，通常为 control plane 节点。

{{</ notice >}}

## 步骤 2：配置集群参数

编辑 `config.yaml`，配置集群参数：

```yaml
apiVersion: kubekey.kubesphere.io/v1
kind: Config
metadata:
  name: default
spec:
  kubernetes:
    version: v1.34.4
    cluster_name: cluster.local
    container_manager: containerd
  network:
    plugin: calico
    kube_pods_cidr: 10.233.64.0/18
    kube_service_cidr: 10.233.0.0/18
  registry:
    private_registry: ""
    registry_mirrors: []
    insecure_registries: []
  addons: []
```

{{< notice note >}}

- `version` 必须与离线包中的 Kubernetes 版本一致（v1.34.4）。
- `container_manager` 固定为 `containerd`，不再支持 Docker。
- 如需配置私有镜像仓库，修改 `private_registry` 字段。

{{</ notice >}}

## 步骤 3：创建集群

```bash
./kk create cluster -i inventory.yaml -c config.yaml
```

安装过程会自动完成以下操作：

1. 安装 containerd 容器运行时
2. 部署 Kubernetes 控制平面和工作节点
3. 启动内置镜像仓库并推送所有必需镜像
4. 安装 Kube AI Hub 平台组件

## 步骤 4：验证安装

安装完成后，检查集群状态：

```bash
kubectl get nodes
kubectl get pod --all-namespaces
```

查看 Kube AI Hub 安装日志：

```bash
kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
```

## 配置 CoreDNS 和 nodelocaldns（可选）

如果集群节点无法解析外部域名，需要配置 CoreDNS 和 nodelocaldns：

### CoreDNS

编辑 CoreDNS ConfigMap：

```bash
kubectl edit configmap coredns -n kube-system
```

在 `Corefile` 中添加 hosts 插件配置：

```
.:53 {
    errors
    health
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    hosts {
        192.168.0.2  control-plane
        192.168.0.3  node1
        192.168.0.4  node2
        fallthrough
    }
    prometheus :9153
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
    loadbalance
}
```

### nodelocaldns

如果启用了 nodelocaldns，编辑其 ConfigMap：

```bash
kubectl edit configmap nodelocaldns -n kube-system
```

确保 `Corefile` 中包含正确的 hosts 配置。

## 常见问题

### 1. 镜像拉取失败

确认 `config.yaml` 中的 `private_registry` 配置正确，且镜像仓库节点已启动。

### 2. 节点无法加入集群

检查节点间网络连通性，确保防火墙已关闭或已开放所需端口（参考[端口要求](../port-firewall/)）。

### 3. 时间不同步

确保所有节点时间同步：

```bash
# 使用 chrony 或 ntp
timedatectl set-ntp true
```
