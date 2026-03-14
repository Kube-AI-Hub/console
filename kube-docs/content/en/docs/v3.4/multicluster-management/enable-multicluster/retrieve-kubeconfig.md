---
title: "Retrieve Kubeconfig"
keywords: 'Kubernetes, Kube AI Hub, multicluster, hybrid-cloud, kubeconfig'
description: 'Retrieve the kubeconfig required for direct connection imports and learn where to open kubeconfig from the overview page.'
titleLink: "Retrieve KubeConfig"
weight: 5230
---

You need to provide the kubeconfig of a member cluster if you import it using [direct connection](../direct-connection/). For clusters that are already connected to the console, users granted the `platform-admin` role can also open the `kubeconfig` entry from the **Tools** card on the cluster **Overview** page.

![](/images/docs/v3.x/cluster-overview/tools-access.svg)

## Prerequisites

You need a Kubernetes cluster and the permission to read its kubeconfig.

## Open the kubeconfig page from the console

1. Log in to Kube AI Hub with a user granted the `platform-admin` role.

2. Go to **Platform** > **Cluster Management**, and open the **Overview** page of the target cluster.

3. In the **Tools** card, click **kubeconfig**.

4. View, copy, or download the kubeconfig content from the page that opens.

{{< notice info >}}

The `kubeconfig` entry on the overview page is intended for clusters that are already connected to the console. If you are preparing a cluster for direct connection import, retrieve the kubeconfig from the Kubernetes cluster itself.

{{</ notice >}}

## Retrieve kubeconfig from a Kubernetes node

For a member cluster that is about to be imported, the kubeconfig is commonly available at `$HOME/.kube/config` on a control plane or administration node. Use the following command to print the raw kubeconfig:

```bash
kubectl config view --raw
```

```yaml
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: <certificate-authority-data>
    server: https://lb.kube-ai-hub.local:6443
  name: cluster.local
contexts:
- context:
    cluster: cluster.local
    user: kubernetes-admin
  name: kubernetes-admin@cluster.local
current-context: kubernetes-admin@cluster.local
kind: Config
preferences: {}
users:
- name: kubernetes-admin
  user:
    client-certificate-data: <client-certificate-data>
    client-key-data: <client-key-data>
```

## Use kubeconfig during cluster import

1. In the Kube AI Hub console, choose to import the member cluster through **Direct connection**.

2. Paste or upload the kubeconfig content as prompted by the page.

3. Make sure the API server address in the `server` field is reachable from the host cluster.

4. Submit the import task and wait for the cluster status to update.

{{< notice warning >}}

The kubeconfig usually contains API server addresses, certificates, and credentials. Store it carefully and avoid exposing it publicly.

{{</ notice >}}
