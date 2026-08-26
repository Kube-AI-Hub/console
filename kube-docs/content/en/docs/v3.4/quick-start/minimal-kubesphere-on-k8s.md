---
title: "Minimal Kube AI Hub on Kubernetes"
keywords: 'Kube AI Hub, Kubernetes, Minimal, Installation'
description: 'Install Kube AI Hub on an existing Kubernetes cluster with a minimal installation package. Your Kubernetes cluster can be hosted on cloud or on-premises.'
linkTitle: "Minimal Kube AI Hub on Kubernetes"
weight: 2200,
showSubscribe: true
---

In addition to installing Kube AI Hub on a Linux machine, you can also deploy it on existing Kubernetes clusters. This tutorial demonstrates the general steps of completing a minimal Kube AI Hub installation on Kubernetes. For more information, see [Installing on Kubernetes](../../installing-on-kubernetes/).

## Prerequisites

- To install Kube AI Hub 3.4 on Kubernetes, your Kubernetes version must be v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, and v1.34.x (v1.34.x recommended).
- Make sure your machine meets the minimal hardware requirement: CPU > 1 Core, Memory > 2 GB.
- A **default** Storage Class in your Kubernetes cluster needs to be configured before the installation.

{{< notice note >}}

- The CSR signing feature is activated in `kube-apiserver` when it is started with the `--cluster-signing-cert-file` and `--cluster-signing-key-file` parameters. See [RKE installation issue](https://github.com/kubesphere/kubesphere/issues/1925#issuecomment-591698309).
- For more information about the prerequisites of installing Kube AI Hub on Kubernetes, see [Prerequisites](../../installing-on-kubernetes/introduction/prerequisites/).

{{</ notice >}}

## Video Demonstration

{{< youtube 6wdOBD4gyg4 >}}

## Deploy Kube AI Hub

After you make sure your machine meets the conditions, perform the following steps to install Kube AI Hub.

1. Run the following commands to start installation:

    ```bash
    ```bash
    # Obtain the YAML files from the delivery channel
    kubectl apply -f kubesphere-installer.yaml
    
    kubectl apply -f cluster-configuration.yaml
    ```

2. After Kube AI Hub is successfully installed, you can run the following command to view the installation logs:

    ```bash
    kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
    ```

3. Use `kubectl get pod --all-namespaces` to see whether all Pods are running normally in relevant namespaces of Kube AI Hub. If they are, check the port (`30880` by default) of the console by running the following command:

    ```bash
    kubectl get svc/ks-console -n kubesphere-system
    ```

4. Make sure port `30880` is opened in your security group and access the web console through the NodePort (`IP:30880`) with the default account and password (`admin/P@88w0rd`).

5. After logging in to the console, you can check the status of different components in **System Components**. You may need to wait for some components to be up and running if you want to use related services.

## Enable Pluggable Components (Optional)

This guide is used only for the minimal installation by default. For more information about how to enable other components in Kube AI Hub, see [Enable Pluggable Components](../../pluggable-components/).

## Code Demonstration
<script src="https://asciinema.org/a/362122.js" id="asciicast-362122" async></script>
