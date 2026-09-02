---
title: "Install Huawei Ascend Driver"
keywords: 'Ascend, NPU, npu-smi, Ascend Docker Runtime, Kube AI Hub, 910C, 910B, 310P'
description: 'Install Huawei Ascend NPU drivers, firmware, and Ascend Docker Runtime on Linux NPU nodes.'
linkTitle: "Huawei Ascend"
weight: 3172
---

This guide describes how to install Huawei Ascend NPU drivers, firmware, and Ascend Docker Runtime on Linux NPU nodes so that Kube AI Hub can schedule Ascend NPU workloads. Complete these steps on all NPU worker nodes **before** KubeKey creates the cluster.

## Prerequisites

- Node has Huawei Ascend NPUs (for example 910C, 910B, 310P / 310P48; verify against your hardware)
- `root` or `sudo` privileges
- [Time synchronization](../introduction/time-synchronization/) is configured
- Driver, firmware, and runtime packages matching your NPU model, OS, and architecture are prepared

## Installation Order

{{< notice note >}}

- **First-time install**: **Driver → Firmware**
- **Overwrite install or upgrade**: **Firmware → Driver**

{{</ notice >}}

## Installation Media

| Type | Example Filename |
| ---- | ---------------- |
| NPU driver | `Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run` |
| NPU firmware | `Ascend-hdk-{model}-npu-firmware_{version}.run` |
| Ascend Docker Runtime | `Ascend-docker-runtime_{version}_linux-{arch}.run` |

Replace `{model}`, `{version}`, and `{arch}` with actual values (e.g., `910b`, `x86_64`).

**Download links:**

- [Ascend Community Drivers and Firmware](https://www.hiascend.com/hardware/firmware-drivers/community)
- [Ascend Docker Runtime (Gitee)](https://gitee.com/ascend/ascend-docker-runtime/releases)

## Create the Runtime User

Ascend driver installation requires the `HwHiAiUser` user:

```bash
sudo groupadd HwHiAiUser 2>/dev/null || true
sudo useradd -g HwHiAiUser -d /home/HwHiAiUser -m HwHiAiUser -s /bin/bash 2>/dev/null || true
```

## Install Dependencies

**RHEL / CentOS / Rocky and similar:**

```bash
sudo yum install -y dkms gcc make kernel-headers-$(uname -r) kernel-devel-$(uname -r)
```

**Ubuntu / Debian:**

```bash
sudo apt-get update
sudo apt-get install -y dkms gcc make linux-headers-$(uname -r)
```

## Install the NPU Driver

Make the package executable and verify integrity:

```bash
chmod +x Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run
./Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run --check
```

`OK` output indicates the package is intact. Install:

```bash
sudo ./Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run --full
```

## Install NPU Firmware

```bash
chmod +x Ascend-hdk-{model}-npu-firmware_{version}.run
./Ascend-hdk-{model}-npu-firmware_{version}.run --check
sudo ./Ascend-hdk-{model}-npu-firmware_{version}.run --full
```

Confirm firmware version matches the package:

```bash
/usr/local/Ascend/driver/tools/upgrade-tool --device_index -1 --component -1 --version
```

## Verify the Driver

```bash
npu-smi info
```

Successful NPU information output indicates the driver is installed correctly.

## Hard-slice prerequisites: AVI and templates

Whole-card scheduling does not depend on vNPU template names. For memory-based hard slicing, enable Ascend Virtualization Instance (AVI) in container mode on the **host**, and confirm the templates this card actually supports.

```bash
# 0 = docker / container mode
npu-smi set -t vnpu-mode -d 0
npu-smi info -t vnpu-mode
# expect: vnpu-mode : docker

npu-smi info -m
npu-smi info -t template-info -i <NPU_ID> -c <CHIP_ID>
```

`template-info` requires `-i` / `-c` (IDs from `npu-smi info -m`). Omitting them can print "not supported" even when AVI is on.

Atlas A3 (910C) training and inference cards use different template names. The cluster default is **training** (`vir06_1c_16g` / `vir12_3c_32g`). If the query returns `vir05_1c_16g` / `vir10_3c_32g`, change the HAMi ConfigMap after install. See [Ascend NPU Usage](../../../cluster-administration/npu-usage/).

## Install Ascend Docker Runtime

You must install **Ascend Docker Runtime**. The cluster injects `runtimeClassName: ascend` on NPU Pods by default so this runtime can mount device nodes and driver libraries. Without it, containers cannot use the NPU and `npu-smi` fails.

Verify and install the runtime package:

```bash
chmod +x Ascend-docker-runtime_{version}_linux-{arch}.run
./Ascend-docker-runtime_{version}_linux-{arch}.run --check
sudo ./Ascend-docker-runtime_{version}_linux-{arch}.run --install
```

## Configure containerd

Edit `/etc/containerd/config.toml` and point the runtime to Ascend Docker Runtime. In the `[plugins."io.containerd.runtime.v1.linux"]` section:

```toml
[plugins."io.containerd.runtime.v1.linux"]
  no_shim = false
  runtime = "/usr/local/Ascend/Ascend-Docker-Runtime/ascend-docker-runtime"
  runtime_root = ""
  shim = "containerd-shim"
  shim_debug = false
```

{{< notice note >}}

If you use KubeKey with `containerManager: containerd`, complete this configuration before cluster creation. Changes after cluster creation require restarting containerd and may affect running Pods.

{{</ notice >}}

Restart containerd to apply the configuration:

```bash
sudo systemctl daemon-reload
sudo systemctl restart containerd
```

## Verification Checklist

| Check | Command | Expected Result |
| ----- | ------- | --------------- |
| Firmware version | `upgrade-tool --device_index -1 --component -1 --version` | Matches package version |
| NPU driver | `npu-smi info` | NPU device information displayed |
| AVI (hard slice) | `npu-smi info -t vnpu-mode` | `vnpu-mode : docker` |
| vNPU templates | `npu-smi info -t template-info -i <NPU_ID> -c <CHIP_ID>` | Training: `vir06*` / `vir12*`; inference: `vir05*` / `vir10*` |
| Ascend Docker Runtime | `ls /usr/local/Ascend/Ascend-Docker-Runtime/ascend-docker-runtime` | File exists and is executable |
| containerd | `systemctl status containerd` | `active (running)` |

## Troubleshooting

### `--check` verification fails

- Re-download the package and confirm it was not corrupted during transfer
- Confirm the package matches your hardware model and OS architecture

### npu-smi fails or produces no output

- Confirm correct install order (first-time: driver → firmware)
- Confirm the `HwHiAiUser` user exists
- Verify kernel headers match the running kernel: `uname -r`

### Containers cannot use the NPU

- Confirm the `runtime` path in `/etc/containerd/config.toml` is correct
- Confirm containerd was restarted
- Consult Ascend official documentation for CANN/driver and container image compatibility
- After the cluster is up, request whole cards or hard-template slices as described in [Ascend NPU Usage](../../../cluster-administration/npu-usage/)
- Hard-slice Pods fail immediately with `create-vnpu` in the log: compare `template-info` with the ConfigMap and keep both on training templates or both on inference templates
