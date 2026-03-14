---
title: "Deploy Kube AI Hub on Huawei CCE"
keywords: "Kube AI Hub, Kubernetes, installation, huawei, cce"
description: "Learn how to deploy Kube AI Hub on Huawei Cloud Container Engine."

weight: 4250
---

This guide walks you through the steps of deploying Kube AI Hub on [Huaiwei CCE](https://support.huaweicloud.com/en-us/qs-cce/cce_qs_0001.html).

## Preparation for Huawei CCE

### Create Kubernetes cluster

First, create a Kubernetes cluster based on the requirements below.

- To install Kube AI Hub 3.4 on Kubernetes, your Kubernetes version must be v1.20.x, v1.21.x, v1.22.x, v1.23.x, * v1.24.x, * v1.25.x, and * v1.26.x. For Kubernetes versions with an asterisk, some features of edge nodes may be unavailable due to incompatability. Therefore, if you want to use edge nodes, you are advised to install Kubernetes v1.23.x.
- Ensure the cloud computing network for your Kubernetes cluster works, or use an elastic IP when you use **Auto Create** or **Select Existing**. You can also configure the network after the cluster is created. Refer to [NAT Gateway](https://support.huaweicloud.com/en-us/productdesc-natgateway/en-us_topic_0086739762.html).
- Select `s3.xlarge.2` `4-core｜8GB` for nodes and add more if necessary (3 and more nodes are required for a production environment).

### Create a public key for kubectl

- Go to **Resource Management** > **Cluster Management** > **Basic Information** > **Network**, and bind `Public apiserver`.
- Select **kubectl** on the right column, go to **Download kubectl configuration file**, and click **Click here to download**, then you will get a public key for kubectl.

After you get the configuration file for kubectl, use kubectl command line to verify the connection to the cluster.

```bash
$ kubectl version
Client Version: version.Info{Major:"1", Minor:"18", GitVersion:"v1.18.8", GitCommit:"9f2892aab98fe339f3bd70e3c470144299398ace", GitTreeState:"clean", BuildDate:"2020-08-15T10:08:56Z", GoVersion:"go1.14.7", Compiler:"gc", Platform:"darwin/amd64"}
Server Version: version.Info{Major:"1", Minor:"17+", GitVersion:"v1.17.9-r0-CCE20.7.1.B003-17.36.3", GitCommit:"136c81cf3bd314fcbc5154e07cbeece860777e93", GitTreeState:"clean", BuildDate:"2020-08-08T06:01:28Z", GoVersion:"go1.13.9", Compiler:"gc", Platform:"linux/amd64"}
```

## Deploy Kube AI Hub

### Create a custom StorageClass

{{< notice note >}}

Huawei CCE built-in Everest CSI provides StorageClass `csi-disk` which uses SATA (normal I/O) by default, but the actual disk that is used for Kubernetes clusters is either SAS (high I/O) or SSD (extremely high I/O). Therefore, it is suggested that you create an extra StorageClass and set it as **default**. Refer to the official document - [Use kubectl to create a cloud storage](https://support.huaweicloud.com/en-us/usermanual-cce/cce_01_0044.html).

{{</ notice >}}

Below is an example to create a SAS (high I/O) for its corresponding StorageClass.

```yaml
# csi-disk-sas.yaml

---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
    storageclass.kubesphere.io/support-snapshot: "false"
  name: csi-disk-sas
parameters:
  csi.storage.k8s.io/csi-driver-name: disk.csi.everest.io
  csi.storage.k8s.io/fstype: ext4
  # Bind Huawei “high I/O storage. If use “extremely high I/O, change it to SSD.
  everest.io/disk-volume-type: SAS
  everest.io/passthrough: "true"
provisioner: everest-csi-provisioner
allowVolumeExpansion: true
reclaimPolicy: Delete
volumeBindingMode: Immediate

```

For how to set up or cancel a default StorageClass, refer to Kubernetes official document - [Change Default StorageClass](https://kubernetes.io/docs/tasks/administer-cluster/change-default-storage-class/).

### Use ks-installer to minimize the deployment

Use [ks-installer](https://github.com/kubesphere/ks-installer) to deploy Kube AI Hub on an existing Kubernetes cluster. Execute the following commands directly for a minimal installation:

```bash
kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/kubesphere-installer.yaml

kubectl apply -f https://github.com/kubesphere/ks-installer/releases/download/v3.4.1/cluster-configuration.yaml
```

Go to **Workload** > **Pod** and check the running status of Pods in the `kubesphere-system` namespace to confirm the minimal deployment. When the `ks-console-*` Pod becomes ready, the Kube AI Hub console is available.

### Expose Kube AI Hub Console

Check the running status of Pods in `kubesphere-system` namespace and make sure the basic components of  Kube AI Hub are running. Then expose Kube AI Hub console.

Go to **Resource Management** > **Network** and edit the `ks-console` Service. It is recommended that you use `LoadBalancer`, which requires a public IP.

Default settings are usually sufficient for the remaining fields. After the Service is updated, confirm that an external access address has been assigned and use it to open the login page.

After you set LoadBalancer for Kube AI Hub console, you can visit it via the given address. Go to Kube AI Hub login page and use the default account (username `admin` and password `P@88w0rd`) to log in.

## Enable Pluggable Components (Optional)

The example above demonstrates the process of a default minimal installation. To enable other components in Kube AI Hub, see [Enable Pluggable Components](../../../pluggable-components/) for more details.

{{< notice warning >}}

Before you use Istio-based features of Kube AI Hub, you have to delete `applications.app.k8s.io` built in Huawei CCE due to the CRD conflict. You can run the command `kubectl delete crd applications.app.k8s.io` directly to delete it.

{{</ notice >}}

After your component is installed, go to the **Cluster Management** page, and you will see the interface below. You can check the status of your component in **System Components**.
