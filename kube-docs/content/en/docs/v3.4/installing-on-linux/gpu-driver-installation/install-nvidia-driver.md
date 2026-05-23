---
title: "Install NVIDIA Driver"
keywords: 'NVIDIA, GPU, driver, nvidia-smi, Container Toolkit, Kube AI Hub'
description: 'Install the NVIDIA GPU driver, NVIDIA Container Toolkit, and container runtime configuration on Linux GPU nodes.'
linkTitle: "NVIDIA"
weight: 3171
---

This guide describes how to install the NVIDIA GPU driver and NVIDIA Container Toolkit on Linux GPU nodes so that Kube AI Hub can schedule GPU workloads. Complete these steps on all GPU worker nodes **before** KubeKey creates the cluster.

## Prerequisites

- Node has NVIDIA GPU(s) (x86_64)
- **Ubuntu 22.04 LTS**, **Ubuntu 24.04 LTS**, or **RHEL 8/9**, Rocky Linux, AlmaLinux, or compatible distributions is recommended
- `root` or `sudo` privileges
- [Time synchronization](../introduction/time-synchronization/) is configured
- Driver packages matching your GPU model, OS, and kernel version are prepared

## Installation Media

| Type | Example Filename | Notes |
| ---- | ---------------- | ----- |
| GPU driver (Ubuntu deb) | `nvidia-driver-580_580.159.04-1ubuntu1_amd64.deb` | Driver version **580.159.04 or later** is recommended |
| GPU driver (RHEL rpm) | `nvidia-driver-580-580.159.04-1.el9.x86_64.rpm` | Download from the CUDA repository; exact filenames vary |
| Container Toolkit (offline, Ubuntu deb) | `nvidia-container-toolkit_1.19.1-1_amd64.deb` and dependencies | Download from the NVIDIA China CUDA repository; keep package versions aligned |
| Container Toolkit (offline, RHEL rpm) | `nvidia-container-toolkit-1.19.1-1.x86_64.rpm` and dependencies | Download from the matching RHEL CUDA repository |

**Download links:**

- Driver search (by GPU model and OS):
  - China: <https://www.nvidia.cn/drivers/>
  - Global: <https://www.nvidia.com/en-us/drivers/>
- CUDA repository (recommended for Ubuntu/RHEL cluster deployment):
  - Ubuntu 22.04: <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/>
  - Ubuntu 24.04: <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2404/x86_64/>
  - RHEL 8: <https://developer.download.nvidia.cn/compute/cuda/repos/rhel8/x86_64/>
  - RHEL 9: <https://developer.download.nvidia.cn/compute/cuda/repos/rhel9/x86_64/>
- [NVIDIA Container Toolkit Official Install Guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

{{< notice note >}}

Recent NVIDIA driver releases no longer provide `.run` installers. Use deb packages on Ubuntu and rpm packages on RHEL and compatible distributions from the NVIDIA CUDA repository. You can also search for drivers by GPU model on the [NVIDIA driver download page](https://www.nvidia.com/en-us/drivers/) (or [nvidia.cn/drivers](https://www.nvidia.cn/drivers/) in China), but deb/rpm packages from the CUDA repository are still recommended for Linux server cluster deployment.

{{</ notice >}}

{{< notice tip >}}

Download `nvidia-driver-580`, Container Toolkit, and related dependency packages from the NVIDIA China CUDA repository. For fully offline deployment, download all required dependency files from the repository index.

{{</ notice >}}

## Install Driver Dependencies

**Ubuntu / Debian:**

```bash
sudo apt-get update
sudo apt-get install -y gcc linux-headers-$(uname -r) dkms make
```

**RHEL / CentOS / Rocky / AlmaLinux:**

```bash
sudo yum install -y gcc kernel-devel-$(uname -r) kernel-headers-$(uname -r) dkms make
```

## Disable the nouveau Driver

```bash
echo "blacklist nouveau" | sudo tee /etc/modprobe.d/blacklist-nouveau.conf
echo "options nouveau modeset=0" | sudo tee -a /etc/modprobe.d/blacklist-nouveau.conf
```

Rebuild initramfs:

**Ubuntu / Debian:**

```bash
sudo update-initramfs -u
```

**RHEL / CentOS and similar:**

```bash
sudo dracut --force
```

## Install the NVIDIA Driver

### Ubuntu 22.04 / 24.04 (Recommended)

Download driver deb packages from the NVIDIA China CUDA repository:

- Ubuntu 22.04: <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/>
- Ubuntu 24.04: <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2404/x86_64/>

Locate `nvidia-driver-580` and its dependencies in the repository (example: `nvidia-driver-580_580.159.04-1ubuntu1_amd64.deb`), upload them to the node, then run:

```bash
sudo dpkg -i nvidia-driver-580_580.159.04-1ubuntu1_amd64.deb
sudo apt update
sudo apt install -y nvidia-driver-580
sudo reboot
```

After reboot, verify:

```bash
nvidia-smi
```

Successful GPU information output indicates the driver is installed correctly. The driver version shown by `nvidia-smi` should be **580.159.04 or later**.

### RHEL 8 / 9 and Compatible Distributions

Recent NVIDIA drivers are distributed as **rpm packages**. Download them from the NVIDIA China CUDA repository:

- RHEL 8 / Rocky Linux 8 / AlmaLinux 8: <https://developer.download.nvidia.cn/compute/cuda/repos/rhel8/x86_64/>
- RHEL 9 / Rocky Linux 9 / AlmaLinux 9: <https://developer.download.nvidia.cn/compute/cuda/repos/rhel9/x86_64/>

Search the repository for `nvidia-driver-580`, download the main package and its dependencies (example filename: `nvidia-driver-580-580.159.04-1.el9.x86_64.rpm`), upload them to the node, then run:

```bash
sudo rpm -Uvh nvidia-driver-580-580.159.04-1.el9.x86_64.rpm
sudo dnf install -y nvidia-driver-580
sudo reboot
```

If your system uses `yum` instead of `dnf`, replace `dnf install` with `yum install`.

When the node can reach the repository, you can also install directly after configuring the CUDA repo:

```bash
sudo dnf install -y nvidia-driver-580
sudo reboot
```

After reboot, verify:

```bash
nvidia-smi
```

The driver version shown by `nvidia-smi` should be **580.159.04 or later**.

## Install nvidia-fabricmanager

After the driver is installed and the node has rebooted, install `nvidia-fabricmanager` if the server has **NVSwitch** or **NVLink Bridge** (multi-GPU interconnect). **A100 SXM** and other NVSwitch-based multi-GPU systems require this component; without it, CUDA may fail to enumerate GPU devices.

### Determine Whether Installation Is Required

Run the following command to check for NVSwitch or NVLink Bridge devices:

```bash
lspci -nn | grep -i NVIDIA | grep -iE "nvswitch|1af"
```

If the command produces output (showing `NVSwitch`, `Bridge`, or a device ID such as `10de:1af1`), you **must** install Fabric Manager. Example output:

```
1c:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
1d:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
1e:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
1f:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
20:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
21:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
```

You can also use `nvidia-smi topo -m` to inspect NVLink topology. Single-GPU PCIe nodes without the devices above can skip this section and proceed to install Container Toolkit.

### Installation Steps

Download the `nvidia-fabricmanager` package matching your driver version from the NVIDIA CUDA repository:

- Ubuntu 22.04 / 24.04: `ubuntu2204` / `ubuntu2404` repositories
- RHEL 8 / 9: `rhel8` / `rhel9` repositories

**Ubuntu / Debian:**

```bash
sudo dpkg -i nvidia-fabricmanager-{branch}_{version}_amd64.deb
```

**RHEL / CentOS and similar:**

```bash
sudo rpm -Uvh nvidia-fabricmanager-{branch}-{version}.x86_64.rpm
```

Start and verify the service:

```bash
sudo systemctl enable nvidia-fabricmanager
sudo systemctl restart nvidia-fabricmanager
sudo systemctl status nvidia-fabricmanager
```

## Install NVIDIA Container Toolkit

Container Toolkit enables GPU containers under Docker or containerd. Choose one of the following methods based on your network environment.

{{< notice tip >}}

The official online install relies on `nvidia.github.io`, which may be unstable from mainland China. **For online installs in China, use the [USTC mirror](https://mirrors.ustc.edu.cn/help/libnvidia-container.html)** (Option B).

{{</ notice >}}

### Option A: Offline Install

For fully air-gapped environments. On Ubuntu nodes, download Container Toolkit deb packages from the NVIDIA China CUDA repository (keep versions aligned; `1.19.1` is used below as an example):

| Package | Download URL (Ubuntu 22.04 example) |
| ------- | ----------------------------------- |
| `nvidia-container-toolkit` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/nvidia-container-toolkit_1.19.1-1_amd64.deb> |
| `nvidia-container-toolkit-base` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/nvidia-container-toolkit-base_1.19.1-1_amd64.deb> |
| `libnvidia-container1` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/libnvidia-container1_1.19.1-1_amd64.deb> |
| `libnvidia-container-tools` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/libnvidia-container-tools_1.19.1-1_amd64.deb> |

For Ubuntu 24.04, replace `ubuntu2204` with `ubuntu2404` in the paths. You can also browse <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/> and search for `nvidia-container-toolkit` to find the latest version and all dependency deb files.

Upload the packages to the node and install:

```bash
cd /path/to/nvidia-container-toolkit
sudo dpkg -i *.deb
```

**RHEL 8 / 9 and compatible distributions:**

Download Container Toolkit rpm packages from the matching CUDA repository (keep versions aligned; `1.19.1` is used below as an example; exact filenames vary):

| Package | Repository (RHEL 9 example) |
| ------- | --------------------------- |
| `nvidia-container-toolkit` | <https://developer.download.nvidia.cn/compute/cuda/repos/rhel9/x86_64/> |
| `nvidia-container-toolkit-base` | Same as above |
| `libnvidia-container1` | Same as above |
| `libnvidia-container-tools` | Same as above |

For RHEL 8, replace `rhel9` with `rhel8` in the path. Upload the packages to the node and install:

```bash
cd /path/to/nvidia-container-toolkit
sudo rpm -Uvh *.rpm
```

### Option B: Online Install — USTC Mirror (Recommended for China)

Mirror URL: <https://mirrors.ustc.edu.cn/libnvidia-container/>, synced from [NVIDIA/libnvidia-container](https://github.com/NVIDIA/libnvidia-container/). See [USTC Mirror Help](https://mirrors.ustc.edu.cn/help/libnvidia-container.html) for details.

**APT (Ubuntu / Debian):**

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://mirrors.ustc.edu.cn/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://nvidia.github.io#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://mirrors.ustc.edu.cn#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update
sudo apt install -y nvidia-container-toolkit
```

**Yum / DNF (RHEL / CentOS / Rocky and similar):**

```bash
curl -s -L https://mirrors.ustc.edu.cn/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo | \
  sed 's#nvidia.github.io/libnvidia-container/stable/#mirrors.ustc.edu.cn/libnvidia-container/stable/#g' | \
  sed 's#nvidia.github.io/libnvidia-container/experimental/#mirrors.ustc.edu.cn/libnvidia-container/experimental/#g' | \
  sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo

sudo yum install -y nvidia-container-toolkit
```

If you already configured the official repo, switch to the USTC mirror:

```bash
# APT
sudo sed -i 's#nvidia.github.io#mirrors.ustc.edu.cn#g' /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Yum / DNF
sudo sed -i 's#nvidia.github.io/libnvidia-container/stable/#mirrors.ustc.edu.cn/libnvidia-container/stable/#g;s#nvidia.github.io/libnvidia-container/experimental/#mirrors.ustc.edu.cn/libnvidia-container/experimental/#g' /etc/yum.repos.d/nvidia-container-toolkit.repo
```

### Option C: Online Install — Official Source

When GitHub is accessible, follow the [NVIDIA Container Toolkit official install guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) to configure the repo and install.

## Configure the Container Runtime

Run **one** of the following based on your container runtime:

**Docker:**

```bash
sudo nvidia-ctk runtime configure --runtime=docker --set-as-default
sudo systemctl daemon-reload
sudo systemctl restart docker
```

**containerd:**

```bash
sudo nvidia-ctk runtime configure --runtime=containerd --set-as-default
sudo systemctl daemon-reload
sudo systemctl restart containerd
```

Verify Toolkit installation:

```bash
nvidia-ctk -v
```

For containerd, confirm `/etc/containerd/config.toml` defines the `nvidia` runtime with `default_runtime_name = "nvidia"` (written automatically by `nvidia-ctk`).

## Verification Checklist

| Check | Command | Expected Result |
| ----- | ------- | --------------- |
| Driver | `nvidia-smi` | GPU model and driver version displayed |
| Fabric Manager (NVSwitch nodes) | `systemctl status nvidia-fabricmanager` | `active (running)` |
| Container Toolkit | `nvidia-ctk -v` | Version output |

## Troubleshooting

### nvidia-smi fails or produces no output

- Confirm nouveau is disabled: `lsmod | grep nouveau` should return nothing
- Confirm kernel headers match the running kernel: `uname -r` vs installed `linux-headers`
- For Ubuntu deb or RHEL rpm installs, check whether the install failed due to missing dependencies; download missing packages from the CUDA repository and retry
- Check install logs: `/var/log/nvidia-installer.log` (legacy `.run` installs only), or `dnf`/`yum`/`apt` command output

### CUDA Error 802: system not yet initialized

If you see the following error in containers or PyTorch, **especially on A100 SXM GPUs**, the usual cause is that **`nvidia-fabricmanager` is not installed or not running**. This is the most common cause of error 802 on A100 SXM systems: without Fabric Manager, NVSwitch is not initialized and CUDA cannot enumerate devices.

```
CUDA initialization: Unexpected error from cudaGetDeviceCount(). Did you run some cuda functions before calling NumCudaDevices() that might have already set an error? Error 802: system not yet initialized (Triggered internally at /pytorch/c10/cuda/CUDAFunctions.cpp:119.)
  return torch._C._cuda_getDeviceCount() > 0
```

Troubleshooting steps:

1. Check for NVSwitch / NVLink Bridge devices:

```bash
lspci -nn | grep -i NVIDIA | grep -iE "nvswitch|1af"
```

2. If the command above produces output, check Fabric Manager service status:

```bash
systemctl status nvidia-fabricmanager
```

3. If the service is missing or not running, install and start it per [Install nvidia-fabricmanager](#install-nvidia-fabricmanager) above
4. After installation, restart Fabric Manager and verify CUDA again:

```bash
sudo systemctl restart nvidia-fabricmanager
nvidia-smi
python3 -c "import torch; print(torch.cuda.device_count())"
```

### Containers cannot use the GPU

- Confirm `nvidia-ctk runtime configure` was run and Docker/containerd was restarted
- For containerd, check `default_runtime_name = "nvidia"` in `config.toml`
- Test a GPU container: `sudo docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi` (requires a test image)

### Container Toolkit online install fails

- Download Container Toolkit deb packages from the [NVIDIA China CUDA repository](https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/) for offline install, or use the [USTC mirror](https://mirrors.ustc.edu.cn/help/libnvidia-container.html) for online install in mainland China
