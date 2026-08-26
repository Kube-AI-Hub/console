---
title: "All-in-One Installation on Linux"
keywords: 'Kube AI Hub, Kubernetes, All-in-One, Installation'
description: 'Learn how to install Kube AI Hub on Linux with a minimal installation package. This tutorial serves as the basic knowledge for you to understand the container platform, laying the foundation for learning the following guides.'
linkTitle: "All-in-One Installation on Linux"
weight: 2100
---

For those who are new to Kube AI Hub and looking for a quick way to get started with the container platform, the all-in-one installation mode is the best choice to help you deploy Kube AI Hub and Kubernetes with zero configuration.

## Step 1: Prepare a Linux Machine

To get started with all-in-one installation, you only need to prepare one host according to the following requirements for hardware and operating system.

### Hardware Recommendations

<table>
  <tbody>
    <tr>
    <th width='320'>Operating System</th>
    <th>Minimum Requirements</th>
    </tr>
    <tr>
      <td><b>Ubuntu</b> <i>22.04</i>, <i>24.04</i> (24.04 or later recommended)</td>
      <td>2 CPU cores, 4 GB memory, 40 GB disk space</td>
    </tr>
    <tr>
      <td><b>CentOS</b> <i>9</i> or later</td>
      <td>2 CPU cores, 4 GB memory, 40 GB disk space</td>
    </tr>
    <tr>
      <td><b>Kylin</b> <i>V10</i></td>
      <td>2 CPU cores, 4 GB memory, 40 GB disk space</td>
    </tr>
    <tr>
      <td><b>openEuler</b> <i>22.03 LTS</i> or later</td>
      <td>2 CPU cores, 4 GB memory, 40 GB disk space</td>
    </tr>
  </tbody>
</table>

{{< notice note >}}

The system requirements above and the following instructions apply to minimal default installation without any optional components enabled. If your machine has at least 8 CPU cores and 16 GB memory, it is recommended that you enable all components. For more information, see [Enable Pluggable Components](../../pluggable-components/).

{{</ notice >}}

### Node Requirements

- The node must be accessible through `SSH`.
- `sudo`/`curl`/`openssl`/`tar` should be used on the node.

### Container Runtimes

The cluster uses **containerd** as the container runtime. Docker is no longer supported. If you use KubeKey to set up a cluster, KubeKey will install containerd automatically.

<table>
  <tbody>
    <tr>
      <th width='500'>Supported Container Runtime</th>
      <th>Version</th>
    </tr>
    <tr>
      <td>containerd</td>
      <td>1.7+</td>
    </tr>
  </tbody>
</table>

### Dependency Requirements

KubeKey can install Kubernetes and Kube AI Hub together. The dependency that needs to be installed may be different based on the Kubernetes version to be installed. You can refer to the list below to see if you need to install relevant dependencies on your node in advance.

<table>
  <tbody>
    <tr>
      <th>Dependency</th>
     <th>Kubernetes Version ≥ 1.28</th>
    </tr>
    <tr>
      <td><code>socat</code></td>
     <td>Required</td> 
    </tr>
    <tr>
      <td><code>conntrack</code></td>
     <td>Required</td> 
    </tr>
    <tr>
      <td><code>ebtables</code></td>
     <td>Optional but recommended</td> 
    </tr>
    <tr>
      <td><code>ipset</code></td>
     <td>Optional but recommended</td> 
    </tr>
  </tbody>
</table>

{{< notice info >}}

KubeKey is a brand-new installation tool developed in Go, replacing the previous ansible-based installer. KubeKey provides flexible installation options. You can install Kubernetes and Kube AI Hub separately or together, which is convenient and efficient.

{{</ notice >}}

### Network and DNS Requirements

{{< content "common/network-requirements.md" >}}

{{< notice tip >}}

- It's recommended that your OS be clean (without any other software installed). Otherwise, there may be conflicts.
- If you have trouble downloading images from `dockerhub.io`, it is recommended that you prepare a registry mirror (booster) in advance.

{{</ notice >}}

## Step 2: Get KubeKey

KubeKey is included in the Kube AI Hub offline installation package. After extracting the package, select the binary for your architecture:

```bash
# x86_64 architecture
mv kk-x86 kk

# ARM64 architecture
mv kk-arm kk

chmod +x kk
```

{{< notice note >}}

Obtain the offline installation package from your delivery channel. The package includes Kubernetes v1.34.4, containerd, and required images.

{{</ notice >}}

## Step 3: Get Started with Installation

In this quick start tutorial, you only need to execute one command for installation:

```bash
./kk create cluster -i inventory.yaml -c config.yaml
```

{{< notice note >}}

- The offline package contains example `inventory.yaml` and `config.yaml` files. For all-in-one installation, configure the single node with both control plane and worker roles.
- Recommended Kubernetes versions for Kube AI Hub 3.4: v1.28.x or later, v1.34.x recommended. The offline package installs Kubernetes v1.34.4 by default.
- KubeKey will install [OpenEBS](https://openebs.io/) to provision LocalPV for the development and testing environment by default, which is convenient for new users. For other storage types, see [Persistent Storage Configurations](../../installing-on-linux/persistent-storage-configurations/understand-persistent-storage/).

{{</ notice >}}

After you execute the command, KubeKey will check your installation environment and show the results in a table. For more information, see [Node Requirements](#node-requirements) and [Dependency Requirements](#dependency-requirements). Enter `yes` to continue the installation process.

## Step 4: Verify the Installation

Enter the following command to check the installation result.

```bash
kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l 'app in (ks-install, ks-installer)' -o jsonpath='{.items[0].metadata.name}') -f
```

The output displays the IP address and port number of the web console, which is exposed through NodePort `30880` by default. Now, you can access the console at `<NodeIP>:30880` with the default account and password (`admin/P@88w0rd`).

```bash
#####################################################
###              Welcome to Kube AI Hub!           ###
#####################################################

Console: http://192.168.0.2:30880
Account: admin
Password: P@88w0rd

NOTES：
  1. After you log into the console, please check the
     monitoring status of service components in
     "Cluster Management". If any service is not
     ready, please wait patiently until all components 
     are up and running.
  2. Please change the default password after login.

#####################################################
```

{{< notice note >}}

You may need to configure port forwarding rules and open the port in your security group so that external users can access the console.

{{</ notice >}}

After logging in to the console, you can check the status of different components in **System Components**. You may need to wait for some components to be up and running if you want to use related services. You can also use `kubectl get pod --all-namespaces` to check the running status of Kube AI Hub components.

## Enable Pluggable Components (Optional)

This guide is only used for minimal installation by default. To enable other components in Kube AI Hub, see [Enable Pluggable Components](../../pluggable-components/).
