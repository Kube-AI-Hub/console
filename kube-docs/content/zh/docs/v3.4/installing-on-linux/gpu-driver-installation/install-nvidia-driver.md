---
title: "安装英伟达 (NVIDIA) 驱动"
keywords: 'NVIDIA, GPU, 显卡驱动, nvidia-smi, Container Toolkit, Kube AI Hub'
description: '在 Linux GPU 节点上安装 NVIDIA 显卡驱动、NVIDIA Container Toolkit 及容器 runtime 配置。'
linkTitle: "英伟达 (NVIDIA)"
weight: 3171
---

本文介绍在 Linux GPU 节点上安装 NVIDIA 显卡驱动及 NVIDIA Container Toolkit 的步骤，以便 Kube AI Hub 集群能够调度 GPU 工作负载。请在 KubeKey 创建集群**之前**于所有 GPU 工作节点上完成本节操作。

## 前提条件

- 节点配备 NVIDIA GPU（x86_64）
- 建议使用 **Ubuntu 22.04 LTS**、**Ubuntu 24.04 LTS**，或 **RHEL 8/9**、Rocky Linux、AlmaLinux 等兼容发行版
- 具有 `root` 或 `sudo` 权限
- 已完成 [时间同步配置](../introduction/time-synchronization/)
- 已准备与 GPU 型号、操作系统及内核版本匹配的驱动安装包

## 安装介质

| 类型 | 文件名示例 | 说明 |
| ---- | ---------- | ---- |
| 显卡驱动（Ubuntu deb） | `nvidia-driver-580_580.159.04-1ubuntu1_amd64.deb` | 建议驱动版本 **不低于 580.159.04** |
| 显卡驱动（RHEL rpm） | `nvidia-driver-580-580.159.04-1.el9.x86_64.rpm` | 从 CUDA 仓库下载，具体文件名以仓库为准 |
| Container Toolkit（离线，Ubuntu deb） | `nvidia-container-toolkit_1.19.1-1_amd64.deb` 等 | 从 NVIDIA 中国 CUDA 仓库下载，版本号需与依赖包一致 |
| Container Toolkit（离线，RHEL rpm） | `nvidia-container-toolkit-1.19.1-1.x86_64.rpm` 等 | 从对应 RHEL 版本 CUDA 仓库下载 |

**下载地址：**

- 驱动搜索下载（按 GPU 型号、操作系统查询）：
  - 中国：<https://www.nvidia.cn/drivers/>
  - 全球：<https://www.nvidia.com/en-us/drivers/>
- CUDA 仓库（推荐用于 Ubuntu/RHEL 集群部署）：
  - Ubuntu 22.04：<https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/>
  - Ubuntu 24.04：<https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2404/x86_64/>
  - RHEL 8：<https://developer.download.nvidia.cn/compute/cuda/repos/rhel8/x86_64/>
  - RHEL 9：<https://developer.download.nvidia.cn/compute/cuda/repos/rhel9/x86_64/>
- [NVIDIA Container Toolkit 官方安装指南](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

{{< notice note >}}

较新的 NVIDIA 驱动版本已不再提供 `.run` 安装包。Ubuntu 请使用 deb 包，RHEL 及其兼容发行版请使用 rpm 包，均从 NVIDIA CUDA 仓库获取。也可通过 [NVIDIA 驱动下载页](https://www.nvidia.cn/drivers/) 按 GPU 型号搜索驱动，但 Linux 服务器集群部署仍推荐使用 CUDA 仓库中的 deb/rpm 包。

{{</ notice >}}

{{< notice tip >}}

请从 NVIDIA 中国 CUDA 仓库下载 `nvidia-driver-580`、Container Toolkit 及相关依赖包。完全离线部署时，需从仓库目录下载全部依赖文件。

{{</ notice >}}

## 安装驱动依赖

**Ubuntu / Debian：**

```bash
sudo apt-get update
sudo apt-get install -y gcc linux-headers-$(uname -r) dkms make
```

**RHEL / CentOS / Rocky / AlmaLinux：**

```bash
sudo yum install -y gcc kernel-devel-$(uname -r) kernel-headers-$(uname -r) dkms make
```

## 禁用 nouveau 驱动

```bash
echo "blacklist nouveau" | sudo tee /etc/modprobe.d/blacklist-nouveau.conf
echo "options nouveau modeset=0" | sudo tee -a /etc/modprobe.d/blacklist-nouveau.conf
```

重建 initramfs：

**Ubuntu / Debian：**

```bash
sudo update-initramfs -u
```

**RHEL / CentOS 等：**

```bash
sudo dracut --force
```

## 安装 NVIDIA 驱动

### Ubuntu 22.04 / 24.04（推荐）

从 NVIDIA 中国 CUDA 仓库下载驱动 deb 包：

- Ubuntu 22.04：<https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/>
- Ubuntu 24.04：<https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2404/x86_64/>

在仓库目录中找到 `nvidia-driver-580` 及其依赖包（示例：`nvidia-driver-580_580.159.04-1ubuntu1_amd64.deb`），上传至节点后执行：

```bash
sudo dpkg -i nvidia-driver-580_580.159.04-1ubuntu1_amd64.deb
sudo apt update
sudo apt install -y nvidia-driver-580
sudo reboot
```

重启后验证：

```bash
nvidia-smi
```

能正常输出 GPU 信息即表示驱动安装成功。`nvidia-smi` 中显示的驱动版本应 **不低于 580.159.04**。

### RHEL 8 / 9 及兼容发行版

较新的 NVIDIA 驱动以 **rpm 包**形式发布，请从 NVIDIA 中国 CUDA 仓库下载：

- RHEL 8 / Rocky Linux 8 / AlmaLinux 8：<https://developer.download.nvidia.cn/compute/cuda/repos/rhel8/x86_64/>
- RHEL 9 / Rocky Linux 9 / AlmaLinux 9：<https://developer.download.nvidia.cn/compute/cuda/repos/rhel9/x86_64/>

在仓库目录中搜索 `nvidia-driver-580`，下载主包及其依赖 rpm（文件名以仓库为准，示例：`nvidia-driver-580-580.159.04-1.el9.x86_64.rpm`），上传至节点后执行：

```bash
sudo rpm -Uvh nvidia-driver-580-580.159.04-1.el9.x86_64.rpm
sudo dnf install -y nvidia-driver-580
sudo reboot
```

若系统使用 `yum` 而非 `dnf`，将 `dnf install` 替换为 `yum install`。

节点可访问仓库时，也可配置 CUDA 源后直接安装：

```bash
sudo dnf install -y nvidia-driver-580
sudo reboot
```

重启后验证：

```bash
nvidia-smi
```

`nvidia-smi` 中显示的驱动版本应 **不低于 580.159.04**。

## 安装 nvidia-fabricmanager

驱动安装并重启后，若服务器配备 **NVSwitch** 或 **NVLink Bridge**（多卡互联），需继续安装 `nvidia-fabricmanager`。**A100 SXM** 等通过 NVSwitch 互联的多卡系统必须安装此组件，否则 CUDA 可能无法枚举 GPU 设备。

### 判断是否需要安装

执行以下命令检查是否存在 NVSwitch 或 NVLink Bridge 设备：

```bash
lspci -nn | grep -i NVIDIA | grep -iE "nvswitch|1af"
```

若命令有输出（出现 `NVSwitch`、`Bridge` 或设备 ID `10de:1af1` 等），则**必须**安装 Fabric Manager。示例输出：

```
1c:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
1d:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
1e:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
1f:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
20:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
21:00.0 Bridge [0680]: NVIDIA Corporation Device [10de:1af1] (rev a1)
```

也可辅助使用 `nvidia-smi topo -m` 查看 NVLink 拓扑。无上述设备的单卡 PCIe 节点可跳过本节，直接进入下一节安装 Container Toolkit。

### 安装步骤

从 NVIDIA CUDA 仓库下载与驱动版本匹配的 `nvidia-fabricmanager` 包并安装：

- Ubuntu 22.04 / 24.04：对应 `ubuntu2204` / `ubuntu2404` 仓库
- RHEL 8 / 9：对应 `rhel8` / `rhel9` 仓库

**Ubuntu / Debian：**

```bash
sudo dpkg -i nvidia-fabricmanager-{branch}_{version}_amd64.deb
```

**RHEL / CentOS 等：**

```bash
sudo rpm -Uvh nvidia-fabricmanager-{branch}-{version}.x86_64.rpm
```

启动并检查服务：

```bash
sudo systemctl enable nvidia-fabricmanager
sudo systemctl restart nvidia-fabricmanager
sudo systemctl status nvidia-fabricmanager
```

## 安装 NVIDIA Container Toolkit

Container Toolkit 用于在 Docker 或 containerd 中运行 GPU 容器。请根据网络环境选择以下方案之一。

{{< notice tip >}}

NVIDIA Container Toolkit 官方在线安装依赖 `nvidia.github.io`，国内访问 GitHub 可能不稳定。**推荐国内在线环境使用 [中科大 USTC 镜像](https://mirrors.ustc.edu.cn/help/libnvidia-container.html)**（方案 B）。

{{</ notice >}}

### 方案 A：离线安装

适用于完全离线环境。Ubuntu 节点请从 NVIDIA 中国 CUDA 仓库下载 Container Toolkit 相关 deb 包（版本号需保持一致，以下以 `1.19.1` 为例）：

| 包名 | 下载地址（Ubuntu 22.04 示例） |
| ---- | ----------------------------- |
| `nvidia-container-toolkit` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/nvidia-container-toolkit_1.19.1-1_amd64.deb> |
| `nvidia-container-toolkit-base` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/nvidia-container-toolkit-base_1.19.1-1_amd64.deb> |
| `libnvidia-container1` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/libnvidia-container1_1.19.1-1_amd64.deb> |
| `libnvidia-container-tools` | <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/libnvidia-container-tools_1.19.1-1_amd64.deb> |

Ubuntu 24.04 请将路径中的 `ubuntu2204` 替换为 `ubuntu2404`。也可在仓库目录 <https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/> 中搜索 `nvidia-container-toolkit` 获取最新版本及全部依赖 deb 包。

上传至节点后安装：

```bash
cd /path/to/nvidia-container-toolkit
sudo dpkg -i *.deb
```

**RHEL 8 / 9 及兼容发行版：**

从对应 CUDA 仓库下载 Container Toolkit 相关 rpm 包（版本号需保持一致，以下以 `1.19.1` 为例，文件名以仓库为准）：

| 包名 | 下载目录（RHEL 9 示例） |
| ---- | ------------------------- |
| `nvidia-container-toolkit` | <https://developer.download.nvidia.cn/compute/cuda/repos/rhel9/x86_64/> |
| `nvidia-container-toolkit-base` | 同上 |
| `libnvidia-container1` | 同上 |
| `libnvidia-container-tools` | 同上 |

RHEL 8 请将路径中的 `rhel9` 替换为 `rhel8`。上传至节点后安装：

```bash
cd /path/to/nvidia-container-toolkit
sudo rpm -Uvh *.rpm
```

### 方案 B：在线安装 — 中科大 USTC 镜像（推荐）

镜像地址：<https://mirrors.ustc.edu.cn/libnvidia-container/>，同步自 [NVIDIA/libnvidia-container](https://github.com/NVIDIA/libnvidia-container/) 仓库。详细说明见 [USTC Mirror Help](https://mirrors.ustc.edu.cn/help/libnvidia-container.html)。

**APT（Ubuntu / Debian）：**

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://mirrors.ustc.edu.cn/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://nvidia.github.io#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://mirrors.ustc.edu.cn#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update
sudo apt install -y nvidia-container-toolkit
```

**Yum / DNF（RHEL / CentOS / Rocky 等）：**

```bash
curl -s -L https://mirrors.ustc.edu.cn/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo | \
  sed 's#nvidia.github.io/libnvidia-container/stable/#mirrors.ustc.edu.cn/libnvidia-container/stable/#g' | \
  sed 's#nvidia.github.io/libnvidia-container/experimental/#mirrors.ustc.edu.cn/libnvidia-container/experimental/#g' | \
  sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo

sudo yum install -y nvidia-container-toolkit
```

若已配置官方源，可一键替换为 USTC 镜像：

```bash
# APT
sudo sed -i 's#nvidia.github.io#mirrors.ustc.edu.cn#g' /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Yum / DNF
sudo sed -i 's#nvidia.github.io/libnvidia-container/stable/#mirrors.ustc.edu.cn/libnvidia-container/stable/#g;s#nvidia.github.io/libnvidia-container/experimental/#mirrors.ustc.edu.cn/libnvidia-container/experimental/#g' /etc/yum.repos.d/nvidia-container-toolkit.repo
```

### 方案 C：在线安装 — 官方源

网络可正常访问 GitHub 时，按 [NVIDIA Container Toolkit 官方安装指南](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) 配置仓库并安装。

## 配置容器 runtime

根据集群使用的容器运行时，**二选一**执行：

**Docker：**

```bash
sudo nvidia-ctk runtime configure --runtime=docker --set-as-default
sudo systemctl daemon-reload
sudo systemctl restart docker
```

**containerd：**

```bash
sudo nvidia-ctk runtime configure --runtime=containerd --set-as-default
sudo systemctl daemon-reload
sudo systemctl restart containerd
```

验证 Toolkit 安装：

```bash
nvidia-ctk -v
```

使用 containerd 时，确认 `/etc/containerd/config.toml` 中已配置 `nvidia` runtime，`default_runtime_name` 为 `nvidia`（由 `nvidia-ctk` 自动写入）。

## 验证清单

| 检查项 | 命令 | 期望结果 |
| ------ | ---- | -------- |
| 驱动 | `nvidia-smi` | 显示 GPU 型号、驱动版本 |
| Fabric Manager（NVSwitch 节点） | `systemctl status nvidia-fabricmanager` | `active (running)` |
| Container Toolkit | `nvidia-ctk -v` | 输出版本信息 |

## 故障排查

### nvidia-smi 无输出或报错

- 确认 nouveau 已禁用：`lsmod | grep nouveau` 应无输出
- 确认内核头文件与当前运行内核一致：`uname -r` 与 `linux-headers` 版本匹配
- Ubuntu deb 或 RHEL rpm 安装失败时，检查是否因依赖缺失报错，从 CUDA 仓库补全依赖包后重试
- 查看安装日志：`/var/log/nvidia-installer.log`（仅旧版 `.run` 安装方式）、`dnf`/`yum`/`apt` 命令输出

### CUDA Error 802：system not yet initialized

若在容器或 PyTorch 中遇到如下错误，**尤其是 A100 SXM 显卡**，通常原因是 **`nvidia-fabricmanager` 未安装或未运行**。这是 A100 SXM 系统最常见的 802 错误原因：没有 Fabric Manager，NVSwitch 未初始化，CUDA 无法枚举设备。

```
CUDA initialization: Unexpected error from cudaGetDeviceCount(). Did you run some cuda functions before calling NumCudaDevices() that might have already set an error? Error 802: system not yet initialized (Triggered internally at /pytorch/c10/cuda/CUDAFunctions.cpp:119.)
  return torch._C._cuda_getDeviceCount() > 0
```

排查步骤：

1. 检查是否存在 NVSwitch / NVLink Bridge 设备：

```bash
lspci -nn | grep -i NVIDIA | grep -iE "nvswitch|1af"
```

2. 若上述命令有输出，检查 Fabric Manager 服务状态：

```bash
systemctl status nvidia-fabricmanager
```

3. 若服务不存在或未运行，按上文「安装 nvidia-fabricmanager」一节安装并启动
4. 安装后重启 Fabric Manager 并再次验证 CUDA：

```bash
sudo systemctl restart nvidia-fabricmanager
nvidia-smi
python3 -c "import torch; print(torch.cuda.device_count())"
```

### 容器无法使用 GPU

- 确认已执行 `nvidia-ctk runtime configure` 并重启 Docker/containerd
- 使用 containerd 时检查 `config.toml` 中 `default_runtime_name = "nvidia"`
- 测试 GPU 容器：`sudo docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi`（需有可用的测试镜像）

### Container Toolkit 在线安装失败

- 国内环境优先从 [NVIDIA 中国 CUDA 仓库](https://developer.download.nvidia.cn/compute/cuda/repos/ubuntu2204/x86_64/) 下载 Container Toolkit deb 包离线安装，或改用 [USTC 镜像](https://mirrors.ustc.edu.cn/help/libnvidia-container.html) 在线安装
