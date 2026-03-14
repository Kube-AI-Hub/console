---
title: "Installing Kube AI Hub on Kubernetes — Overview"
keywords: "Kube AI Hub, Kubernetes, Installation"
description: "Develop a basic understanding of the general steps of deploying Kube AI Hub on an existing Kubernetes cluster."
linkTitle: "Overview"
weight: 4110
---

As part of Kube AI Hub's commitment to provide a plug-and-play architecture for users, it can be easily installed on existing Kubernetes clusters. More specifically, Kube AI Hub can be deployed on Kubernetes either hosted on clouds (for example, AWS EKS, QingCloud QKE and Google GKE) or on-premises. This is because Kube AI Hub does not hack Kubernetes itself. It only interacts with the Kubernetes API to manage Kubernetes cluster resources. In other words, Kube AI Hub can be installed on any native Kubernetes cluster and Kubernetes distribution.

This section gives you an overview of the general steps of installing Kube AI Hub on Kubernetes. For more information about the specific way of installation in different environments, see Installing on Hosted Kubernetes and Installing on On-premises Kubernetes.

{{< notice note >}}

Read [Prerequisites](../prerequisites/) before you install Kube AI Hub on existing Kubernetes clusters.

{{</ notice >}}

## Deploy Kube AI Hub

After you make sure your existing Kubernetes cluster meets all the requirements, you can use kubectl to install Kube AI Hub with the default minimal package.

1. Execute the following commands to start installation:

   ```bash
   kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/kubesphere-installer.yaml

   kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/cluster-configuration.yaml
   ```

2. Inspect the logs of installation:

   ```bash
   kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
   ```

3. Use `kubectl get pod --all-namespaces` to see whether all pods are running normally in relevant namespaces of Kube AI Hub. If they are, check the port (30880 by default) of the console through the following command:

   ```bash
   kubectl get svc/ks-console -n kubesphere-system
   ```

4. Make sure port 30880 is opened in security groups and access the web console through the NodePort (`IP:30880`) with the default account and password (`admin/P@88w0rd`). After login, review the cluster overview and system component status first, and then change the default password.

## Enable Pluggable Components (Optional)

If you start with a default minimal installation, refer to [Enable Pluggable Components](../../../pluggable-components/) to install other components.

{{< notice tip >}}

- Pluggable components can be enabled either before or after the installation. Please refer to the example file [cluster-configuration.yaml](https://github.com/kubesphere/ks-installer/blob/release-3.0/deploy/cluster-configuration.yaml) for more details.
- Make sure there is enough CPU and memory available in your cluster.
- It is highly recommended that you install these pluggable components to discover the full-stack features and capabilities provided by Kube AI Hub.

{{</ notice >}}
