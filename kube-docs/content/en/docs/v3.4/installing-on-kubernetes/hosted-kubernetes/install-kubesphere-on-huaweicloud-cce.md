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

- To install Kube AI Hub 3.4 on Kubernetes, your Kubernetes version must be v1.28.x, v1.29.x, v1.30.x, v1.31.x, v1.32.x, v1.33.x, or v1.34.x (v1.34.x recommended).
- Ensure the cloud computing network for your Kubernetes cluster works, or use an elastic IP when you use **Auto Create** or **Select Existing**. You can also configure the network after the cluster is created. Refer to [NAT Gateway](https://support.huaweicloud.com/en-us/productdesc-natgateway/en-us_topic_0086739762.html).
- Select `s3.xlarge.2` `4-core｜8GB` for nodes and add more if necessary (3 and more nodes are required for a production environment).

### Create a public key for kubectl

- Go to **Resource Management** > **Cluster Management** > **Basic Information** > **Network**, and bind `Public apiserver`.
- Select **kubectl** on the right column, go to **Download kubectl configuration file**, and click **Click here to download**, then you will get a public key for kubectl.

After you get the configuration file for kubectl, use kubectl command line to verify the connection to the cluster.

```bash
$ kubectl version
Client Version: version.Info{Major:"1", Minor:"34", GitVersion:"v1.34.4", GitCommit:"...", GitTreeState:"clean", BuildDate:"2025-xx-xxTxx:xx:xxZ", GoVersion:"go1.23.x", Compiler:"gc", Platform:"linux/amd64"}
Server Version: version.Info{Major:"1", Minor:"34", GitVersion:"v1.34.4", GitCommit:"...", GitTreeState:"clean", BuildDate:"2025-xx-xxTxx:xx:xxZ", GoVersion:"go1.23.x", Compiler:"gc", Platform:"linux/amd64"}
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
```bash
# Obtain the YAML files from the delivery channel
kubectl apply -f kubesphere-installer.yaml

kubectl apply -f cluster-configuration.yaml
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
