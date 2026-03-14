---
title: "Installing Kube AI Hub on Minikube"
keywords: 'Kube AI Hub, Minikube, Minimal, Installation'
description: 'Install Kube AI Hub on an existing Minikube cluster with a minimal installation package.'
linkTitle: "Installing Kube AI Hub on Minikube"
weight: 2200,
showSubscribe: true
---

In addition to installing Kube AI Hub on a Linux machine, you can also deploy it on minikube cluster. This tutorial demonstrates the general steps of completing a minimal Kube AI Hub installation on Minikube.

## Prerequisites

- To install Kube AI Hub 3.2.1 on Minikube, your Minikube version must be v1.23.x, v1.24.x, v1.25.x.
- Make sure your machine meets the minimal hardware requirement: CPU > 2 Core, Memory > 2 GB, 20GB free disk space, Container or virtual machine manager, such as: Docker, Hyperkit, Hyper-V, KVM, Parallels, Podman, VirtualBox, or VMware Fusion/Workstation.
- A **default** Storage Class in your Minikube cluster needs to be configured before the installation.

## Pre-checks

1. Make sure your minikube version is compatible by running `minikube version` in your terminal. The output may look as below:

    ```bash
    ❯ minikube version
    minikube version: v1.24.0
    commit: 76b94fb3c4e8ac5062daf70d60cf03ddcc0a741b

    ```

2. Check if the available resources in your cluster meet the minimum requirements.

    ```bash
    ❯ free -g
                     total        used        free      shared  buff/cache   available
    Mem:              6           2           2           0           1           3
    Swap:             0           0           0
    ## Memory > 2GB 
    ❯ lscpu
    Architecture:        x86_64
    CPU op-mode(s):      32-bit, 64-bit
    Byte Order:          Little Endian
    Address sizes:       40 bits physical, 48 bits virtual
    CPU(s):              4
    ## More than 2 CPUs
    ❯ df -h
    Filesystem      Size  Used Avail Use% Mounted on
    udev            3.4G     0  3.4G   0% /dev
    tmpfs           694M  2.6M  692M   1% /run
    /dev/sda3       198G  116G   73G  62% /             ## Available more than 20GB free disk space


    ```

3. Make sure your Kubectl version is compatible by running `kubectl version` in your minikube cluster node. The output may look as below:

    ```bash
   ❯ kubectl version
    Client Version: version.Info{Major:"1", Minor:"23", GitVersion:"v1.23.1", GitCommit:"86ec240af8cbd1b60bcc4c03c20da9b98005b92e", GitTreeState:"clean", BuildDate:"2021-12-16T11:41:01Z", GoVersion:"go1.17.5", Compiler:"gc", Platform:"linux/amd64"}
    Server Version: version.Info{Major:"1", Minor:"22", GitVersion:"v1.22.3", GitCommit:"c92036820499fedefec0f847e2054d824aea6cd1", GitTreeState:"clean", BuildDate:"2021-10-27T18:35:25Z", GoVersion:"go1.16.9", Compiler:"gc", Platform:"linux/amd64"}

    ```

    {{< notice note >}}
Pay attention to the `Server Version` line. If `GitVersion` shows an older one, you need to upgrade Kubectl first.
    {{</ notice >}}
4. Check if there is a **default** StorageClass in your cluster. An existing default StorageClass is a prerequisite for Kube AI Hub installation.

    ```bash
    $ kubectl get sc
    NAME                      PROVISIONER               AGE
    glusterfs (default)       kubernetes.io/glusterfs   3d4h
    ```

If your Minikube cluster environment meets all the requirements above, then you are ready to deploy Kube AI Hub on your Minikube.

{{< notice note >}}

- The CSR signing feature is activated in `kube-apiserver` when it is started with the `--cluster-signing-cert-file` and `--cluster-signing-key-file` parameters. See [RKE installation issue](https://github.com/kubesphere/kubesphere/issues/1925#issuecomment-591698309).

{{</ notice >}}

## Video Demonstration

{{< youtube gROOqfupRII>}}

## Deploy Kube AI Hub

After you make sure your machine meets the conditions, perform the following steps to install Kube AI Hub.

1. Start minikube.

    ``` bash
    ❯ minikube start
    😄  minikube v1.24.0 on Debian 10.1
    🎉  minikube 1.25.2 is available! Download it: https://github.com/kubernetes/minikube/releases/tag/v1.25.2
    💡  To disable this notice, run: 'minikube config set WantUpdateNotification false'

    ✨  Using the docker driver based on existing profile
    👍  Starting control plane node minikube in cluster minikube
    🚜  Pulling base image ...
    🔄  Restarting existing docker container for "minikube" ...
    🐳  Preparing Kubernetes v1.22.3 on Docker 20.10.8 ...
    🔎  Verifying Kubernetes components...
        ▪ Using image gcr.io/k8s-minikube/storage-provisioner:v5
    🌟  Enabled addons: storage-provisioner, default-storageclass
    🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
    ```

2. Run the following commands to start installation:

    ```bash
    kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.2.1/kubesphere-installer.yaml
    
    kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.2.1/cluster-configuration.yaml
    ```

3. After Kube AI Hub is successfully installed, you can run the following command to view the installation logs:

    ```bash
    kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
    ```

4. Use `kubectl get pod --all-namespaces` to see whether all Pods are running normally in relevant namespaces of Kube AI Hub. If they are, check the port (`30880` by default) of the console by running the following command:

    ```bash
    kubectl get svc/ks-console -n kubesphere-system
    ```

5. Make sure port `30880` is opened in your security group and access the web console through the NodePort (`IP:30880`) with the default account and password (`admin/P@88w0rd`).

6. After logging in to the console, you can check the status of different components in **System Components**. You may need to wait for some components to be up and running if you want to use related services.

## Enable Pluggable Components (Optional)

This guide is used only for the minimal installation by default. For more information about how to enable other components in Kube AI Hub, see [Enable Pluggable Components](../../../pluggable-components/).

## Code Demonstration

<script id="asciicast-489562" src="https://asciinema.org/a/489562.js" async></script>

## Uninstall Kube AI Hub from Minikube

You can uninstall Kube AI Hub from your existing Minikube cluster by using [kubesphere-delete.sh](https://github.com/Kube-AI-Hub/ks-installer/blob/release-3.4/scripts/kubesphere-delete.sh). Copy it from the [GitHub source file](https://raw.githubusercontent.com/Kube-AI-Hub/ks-installer/release-3.4/scripts/kubesphere-delete.sh) and execute this script on your local machine.

{{< notice warning >}}

Uninstalling will remove Kube AI Hub from your Minikube cluster. This operation is irreversible and does not have any backup. Please be cautious with this operation.

{{</ notice >}}
