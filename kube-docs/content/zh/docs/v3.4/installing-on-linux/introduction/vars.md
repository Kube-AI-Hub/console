---
title: "Kubernetes 集群配置"
keywords: 'Kubernetes, 集群, 配置, KubeKey'
description: '在集群的配置文件中设置 Kubernetes 自定义配置。'
linkTitle: "Kubernetes 集群配置"
weight: 3160
---

当创建 Kubernetes 集群时，您可以使用 [KubeKey](../kubekey/) 去生成含有集群基本信息的配置文件 (`config-sample.yaml`)。有关配置文件中的 Kubernetes 相关参数，请参阅以下示例。

```yaml
  kubernetes:
    version: v1.22.12
    imageRepo: kubesphere
    clusterName: cluster.local
    masqueradeAll: false
    maxPods: 110
    nodeCidrMaskSize: 24
    proxyMode: ipvs
  network:
    plugin: calico
    calico:
      # 推荐 CrossSubnet：同网段节点之间 Pod 流量直连，仅跨网段才封装隧道。
      # KubeKey 生成的示例默认为 Always，会封装所有跨节点流量（见下方参数说明）。
      ipipMode: CrossSubnet
      vxlanMode: Never
      vethMTU: 1440
    kubePodsCIDR: 10.233.64.0/18
    kubeServiceCIDR: 10.233.0.0/18
  registry:
    registryMirrors: []
    insecureRegistries: []
    privateRegistry: ""
  addons: []
```

以下表格会详细描述上面的参数。

  <table border="1">
   <tbody>
   <tr>
     <th width='140'>参数</th>
     <th>描述</th>
   </tr>
   <tr>
     <th colSpan='2'><code>kubernetes</code></th>
   </tr>
   <tr>
     <td><code>version</code></td>
     <td>Kubernetes 安装版本。如未指定 Kubernetes 版本，{{< contentLink "docs/installing-on-linux/introduction/kubekey" "KubeKey" >}} 默认安装 Kubernetes v1.34.4。有关更多信息，请参阅{{< contentLink "docs/installing-on-linux/introduction/kubekey/#support-matrix" "支持矩阵" >}}。</td>
   </tr>
   <tr>
     <td><code>imageRepo</code></td>
     <td>用于下载镜像的 Docker Hub 仓库</td>
   </tr>
   <tr>
     <td><code>clusterName</code></td>
     <td>Kubernetes 集群名称。</td>
   </tr>
   <tr>
     <td><code>masqueradeAll</code>*</td>
       <td>如果使用纯 iptables 代理模式，<code>masqueradeAll</code> 即让 kube-proxy 对所有流量进行源地址转换 (SNAT)。它默认值为 <code>false</code>。</td>
   </tr>
   <tr>
     <td><code>maxPods</code>*</td>
     <td>Kubelet 可运行 Pod 的最大数量，默认值为 <code>110</code>。</td>
   </tr>
   <tr>
     <td><code>nodeCidrMaskSize</code>*</td>
     <td>集群中节点 CIDR 的掩码大小，默认值为 <code>24</code>。</td>
   </tr>
   <tr>
     <td><code>proxyMode</code>*</td>
     <td>使用的代理模式，默认为 <code>ipvs</code>。</td>
   </tr>
   <tr>
     <th colSpan='2'><code>network</code></th>
   </tr>
   <tr>
     <td><code>plugin</code></td>
     <td>是否使用 CNI 插件。KubeKey 默认安装 Calico，您也可以指定为 Flannel。请注意，只有使用 Calico 作为 CNI 插件时，才能使用某些功能，例如 Pod IP 池。</td>
   </tr>
   <tr>
     <td><code>calico.ipipMode</code>*</td>
       <td>用于集群启动时创建 IPv4 池的 IPIP 模式。如果值设置除 <code>Never</code> 以外的值，则参数 <code>vxlanMode</code> 应该被设置成 <code>Never</code>。此参数允许设置值 <code>Always</code>，<code>CrossSubnet</code> 和 <code>Never</code>。默认值为 <code>Always</code>。
       <br/><br/>
       <strong>建议使用 <code>CrossSubnet</code>。</strong><code>Always</code> 会把所有跨节点 Pod 流量都封装进 IPIP 隧道，即使这些节点处在同一个二层网段；改成 <code>CrossSubnet</code> 后，同网段节点之间直接经物理网络通信，只有跨网段时才封装 —— 功能不减，但少一层封装开销。实测两节点同网段时，对象存储的并发写入吞吐提高约 2.4 倍。跨网段场景的放行要求不变，仍需允许 IPIP 协议。
       </td>
   </tr>
   <tr>
     <td><code>calico.vxlanMode</code>*</td>
       <td>用于集群启动时创建 IPv4 池的 VXLAN 模式。如果该值不设为 <code>Never</code>，则参数 <code>ipipMode</code> 应该设为 <code>Never</code>。此参数允许设置值 <code>Always</code>，<code>CrossSubnet</code> 和 <code>Never</code>。默认值为 <code>Never</code>。</td>
   </tr>
   <tr>
     <td><code>calico.vethMTU</code>*</td>
     <td>最大传输单元（maximum transmission unit 简称 MTU）设置可以通过网络传输的最大数据包大小。默认值为 <code>1440</code>。</td>
   </tr>
   <tr>
     <td><code>kubePodsCIDR</code></td>
     <td>Kubernetes Pod 子网的有效 CIDR 块。CIDR 块不应与您的节点子网和 Kubernetes 服务子网重叠。</td>
   </tr>
   <tr>
     <td><code>kubeServiceCIDR</code></td>
     <td>Kubernetes 服务的有效 CIDR 块。CIDR 块不应与您的节点子网和 Kubernetes Pod 子网重叠。</td>
   </tr>
   <tr>
     <th colSpan='2'><code>registry</code></th>
   </tr>
   <tr>
     <td><code>registryMirrors</code></td>
     <td>配置 Docker 仓库镜像以加速下载。有关详细信息，请参阅{{< contentLink "https://docs.docker.com/registry/recipes/mirror/#configure-the-docker-daemon" "配置 Docker 守护进程" >}}。</td>
   </tr>
   <tr>
     <td><code>insecureRegistries</code></td>
     <td>设置不安全镜像仓库的地址。有关详细信息，请参阅{{< contentLink "https://docs.docker.com/registry/insecure/" "测试不安全仓库" >}}。</td>
   </tr>
   <tr>
     <td><code>privateRegistry</code>*</td>
     <td>配置私有镜像仓库，用于离线安装（例如，Docker 本地仓库或 Harbor）。有关详细信息，请参阅{{< contentLink "docs/v3.4/installing-on-linux/introduction/air-gapped-installation/" "离线安装" >}}。</td>
   </tr> 
   </tbody>
   </table>




{{< notice note >}}

- \*默认情况下，KubeKey 不会在配置文件中定义这些参数，您可以手动添加这些参数并自定义其值。
- `addons` 用于安装云原生扩展 (Addon)（YAML 或 Chart）。有关详细信息，请参阅此[文件](https://github.com/kubesphere/kubekey/blob/release-2.2/docs/addons.md)。
- 此页面仅列出 KubeKey 创建的配置文件中的部分参数。有关其他参数的详细信息，请参阅此[示例文件](https://github.com/kubesphere/kubekey/blob/release-2.2/docs/config-example.md)。

{{</ notice >}} 

