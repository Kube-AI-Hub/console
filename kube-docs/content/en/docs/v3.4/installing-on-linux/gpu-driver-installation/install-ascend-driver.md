---
title: "Install Huawei Ascend Driver"
keywords: 'Ascend, NPU, npu-smi, Ascend Docker Runtime, Kube AI Hub'
description: 'Install Huawei Ascend NPU drivers, firmware, and Ascend Docker Runtime on Linux NPU nodes.'
linkTitle: "Huawei Ascend"
weight: 3172
---

This guide describes how to install Huawei Ascend NPU drivers, firmware, and Ascend Docker Runtime on Linux NPU nodes so that Kube AI Hub can schedule Ascend NPU workloads. Complete these steps on all NPU worker nodes **before** KubeKey creates the cluster.

## Prerequisites

- Node has Huawei Ascend NPUs (e.g., 910B; verify against your hardware)
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

## Install Ascend Docker Runtime

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
