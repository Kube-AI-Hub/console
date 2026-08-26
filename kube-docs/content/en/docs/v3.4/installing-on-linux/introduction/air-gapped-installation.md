---
title: "Air-gapped Installation"
keywords: 'Air-gapped Installation, Installation, Kube AI Hub'
description: 'Learn how to install Kubernetes and Kube AI Hub in an air-gapped environment using KubeKey.'
linkTitle: "Air-gapped Installation"
weight: 3140
---

You can use the Kube AI Hub offline installation package to install Kubernetes and Kube AI Hub in an air-gapped environment. The offline package includes Kubernetes, containerd, image registry, and all required components, with no external network access needed.

## Prerequisites

1. Obtain the Kube AI Hub offline installation package from your delivery channel (usually in `.tar.gz` or `.tar` format).

2. Upload the package to the target node and extract it:

   ```bash
   tar -xzf kube-ai-hub-offline-<version>.tar.gz
   cd kube-ai-hub-offline-<version>
   ```

3. Select the KubeKey binary for your architecture:

   ```bash
   # x86_64 architecture
   mv kk-x86 kk

   # ARM64 architecture
   mv kk-arm kk

   chmod +x kk
   ```

## Step 1: Configure Host Inventory

Edit `inventory.yaml` to define cluster nodes and role groups:

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

- Modify the configuration according to your actual node IPs, hostnames, and architecture (`amd64` or `arm64`).
- If using password authentication, replace `private_key` with `password: <password>`.
- The `image_registry` group specifies the image registry node, typically the control plane node.

{{</ notice >}}

## Step 2: Configure Cluster Parameters

Edit `config.yaml` to configure cluster parameters:

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

- `version` must match the Kubernetes version in the offline package (v1.34.4).
- `container_manager` is fixed to `containerd`; Docker is no longer supported.
- To configure a private image registry, modify the `private_registry` field.

{{</ notice >}}

## Step 3: Create the Cluster

```bash
./kk create cluster -i inventory.yaml -c config.yaml
```

The installation process automatically completes the following:

1. Install containerd container runtime
2. Deploy Kubernetes control plane and worker nodes
3. Start the built-in image registry and push all required images
4. Install Kube AI Hub platform components

## Step 4: Verify the Installation

After installation, check the cluster status:

```bash
kubectl get nodes
kubectl get pod --all-namespaces
```

View Kube AI Hub installation logs:

```bash
kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
```

## Configure CoreDNS and nodelocaldns (Optional)

If cluster nodes cannot resolve external domain names, configure CoreDNS and nodelocaldns:

### CoreDNS

Edit the CoreDNS ConfigMap:

```bash
kubectl edit configmap coredns -n kube-system
```

Add hosts plugin configuration in the `Corefile`:

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

If nodelocaldns is enabled, edit its ConfigMap:

```bash
kubectl edit configmap nodelocaldns -n kube-system
```

Ensure the `Corefile` contains the correct hosts configuration.

## FAQ

### 1. Image Pull Failure

Confirm that the `private_registry` configuration in `config.yaml` is correct and the image registry node is running.

### 2. Node Cannot Join Cluster

Check network connectivity between nodes and ensure the firewall is disabled or required ports are open (refer to [Port Requirements](../port-firewall/)).

### 3. Time Synchronization

Ensure all nodes are time-synchronized:

```bash
# Using chrony or ntp
timedatectl set-ntp true
```
