---
title: "安装华为昇腾 (Ascend) 驱动"
keywords: 'Ascend, 昇腾, NPU, npu-smi, Ascend Docker Runtime, Kube AI Hub, 910C, 910B, 310P'
description: '在 Linux NPU 节点上安装华为昇腾驱动、固件及 Ascend Docker Runtime。'
linkTitle: "华为昇腾 (Ascend)"
weight: 3172
---

本文介绍在 Linux NPU 节点上安装华为昇腾驱动、固件及 Ascend Docker Runtime 的步骤，以便 Kube AI Hub 集群能够调度昇腾 NPU 工作负载。请在 KubeKey 创建集群**之前**于所有 NPU 工作节点上完成本节操作。

## 前提条件

- 节点配备华为昇腾 NPU（如 910C、910B、310P / 310P48，以实际硬件为准）
- 具有 `root` 或 `sudo` 权限
- 已完成 [时间同步配置](../introduction/time-synchronization/)
- 已准备与 NPU 型号、操作系统及架构匹配的驱动、固件与 runtime 安装包

## 安装顺序

{{< notice note >}}

- **首次安装**：按 **驱动 → 固件** 顺序执行
- **覆盖安装或升级**：按 **固件 → 驱动** 顺序执行

{{</ notice >}}

## 安装介质

| 类型 | 文件名示例 |
| ---- | ---------- |
| NPU 驱动 | `Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run` |
| NPU 固件 | `Ascend-hdk-{model}-npu-firmware_{version}.run` |
| Ascend Docker Runtime | `Ascend-docker-runtime_{version}_linux-{arch}.run` |

将 `{model}`、`{version}`、`{arch}` 替换为实际值（如 `910b`、`x86_64`）。

**下载地址：**

- [昇腾社区驱动与固件](https://www.hiascend.com/hardware/firmware-drivers/community)
- [Ascend Docker Runtime（Gitee）](https://gitee.com/ascend/ascend-docker-runtime/releases)

## 创建运行用户

昇腾驱动安装要求存在 `HwHiAiUser` 用户：

```bash
sudo groupadd HwHiAiUser 2>/dev/null || true
sudo useradd -g HwHiAiUser -d /home/HwHiAiUser -m HwHiAiUser -s /bin/bash 2>/dev/null || true
```

## 安装依赖

**RHEL / CentOS / Rocky 等：**

```bash
sudo yum install -y dkms gcc make kernel-headers-$(uname -r) kernel-devel-$(uname -r)
```

**Ubuntu / Debian：**

```bash
sudo apt-get update
sudo apt-get install -y dkms gcc make linux-headers-$(uname -r)
```

## 安装 NPU 驱动

赋予执行权限并校验安装包：

```bash
chmod +x Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run
./Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run --check
```

输出 `OK` 表示包完整。执行安装：

```bash
sudo ./Ascend-hdk-{model}-npu-driver_{version}_linux-{arch}.run --full
```

## 安装 NPU 固件

```bash
chmod +x Ascend-hdk-{model}-npu-firmware_{version}.run
./Ascend-hdk-{model}-npu-firmware_{version}.run --check
sudo ./Ascend-hdk-{model}-npu-firmware_{version}.run --full
```

确认固件版本与安装包一致：

```bash
/usr/local/Ascend/driver/tools/upgrade-tool --device_index -1 --component -1 --version
```

## 验证驱动

```bash
npu-smi info
```

能正常输出 NPU 信息即表示驱动安装成功。

## 硬切分前置：AVI 与模板

整卡调度不依赖 vNPU 模板。若要按显存硬切分，请在**物理机**上启用昇腾虚拟化实例（AVI）容器模式，并确认该卡实际支持的模板名。

```bash
# 0 = docker / 容器模式
npu-smi set -t vnpu-mode -d 0
npu-smi info -t vnpu-mode
# 期望：vnpu-mode : docker

npu-smi info -m
npu-smi info -t template-info -i <NPU_ID> -c <CHIP_ID>
```

`template-info` 必须带 `-i` / `-c`（ID 来自 `npu-smi info -m`）。省略参数时部分驱动会报「不支持」，并不代表 AVI 未开。

Atlas A3（910C）训练卡与推理卡的模板名不同。集群默认按**训练卡**配置（`vir06_1c_16g` / `vir12_3c_32g`）。若查询结果是 `vir05_1c_16g` / `vir10_3c_32g`，安装 HAMi 后必须改 ConfigMap，步骤见 [昇腾 NPU 使用](../../../cluster-administration/npu-usage/)。

## 安装 Ascend Docker Runtime

必须安装 **Ascend Docker Runtime**。集群默认将 `runtimeClassName: ascend` 注入 NPU Pod，由该 runtime 挂载设备节点与驱动库。未安装时，容器内无法使用 NPU，`npu-smi` 也会失败。

校验并安装 runtime 包：

```bash
chmod +x Ascend-docker-runtime_{version}_linux-{arch}.run
./Ascend-docker-runtime_{version}_linux-{arch}.run --check
sudo ./Ascend-docker-runtime_{version}_linux-{arch}.run --install
```

## 配置 containerd

编辑 `/etc/containerd/config.toml`，确认 runtime 指向 Ascend Docker Runtime。在 `[plugins."io.containerd.runtime.v1.linux"]` 段中设置：

```toml
[plugins."io.containerd.runtime.v1.linux"]
  no_shim = false
  runtime = "/usr/local/Ascend/Ascend-Docker-Runtime/ascend-docker-runtime"
  runtime_root = ""
  shim = "containerd-shim"
  shim_debug = false
```

{{< notice note >}}

若使用 KubeKey 且 `containerManager` 为 `containerd`，请在创建集群前完成上述配置；集群创建后修改需重启 containerd 并可能影响已有 Pod。

{{</ notice >}}

重启 containerd 使配置生效：

```bash
sudo systemctl daemon-reload
sudo systemctl restart containerd
```

KubeKey / containerd 1.7 的 CRI 还要用 **名为 `ascend` 的 runtime**，`RuntimeClass` 的 `handler` 才能对上。在 `[plugins."io.containerd.grpc.v1.cri".containerd.runtimes]` 下增加（不要改掉已有的 `runc`）：

```toml
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.ascend]
  runtime_type = "io.containerd.runc.v2"
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.ascend.options]
    BinaryName = "/usr/local/Ascend/Ascend-Docker-Runtime/ascend-docker-runtime"
    SystemdCgroup = true
```

纯 NPU 节点可以把 `default_runtime_name` 设为 `ascend`；NVIDIA 和昇腾混部时保持 `runc`，只给 NPU Pod 使用 RuntimeClass。

改完后再次 `sudo systemctl restart containerd`。

## 创建 RuntimeClass

集群里必须有名为 `ascend` 的 RuntimeClass，否则 Pod 会报 `RuntimeClass "ascend" not found`。HAMi 的 `ascend-device-plugin` 子 Chart 默认会创建；若没有，手动执行：

```bash
kubectl apply -f - <<'EOF'
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: ascend
handler: ascend
EOF

kubectl get runtimeclass ascend
```

`handler` 必须等于 containerd 里 `runtimes.` 后面的名字（`ascend`）。

## 验证清单

| 检查项 | 命令 | 期望结果 |
| ------ | ---- | -------- |
| 固件版本 | `upgrade-tool --device_index -1 --component -1 --version` | 与安装包版本一致 |
| NPU 驱动 | `npu-smi info` | 显示 NPU 设备信息 |
| AVI（硬切分） | `npu-smi info -t vnpu-mode` | `vnpu-mode : docker` |
| vNPU 模板 | `npu-smi info -t template-info -i <NPU_ID> -c <CHIP_ID>` | 训练卡为 `vir06*` / `vir12*`，推理卡为 `vir05*` / `vir10*` |
| Ascend Docker Runtime | `ls /usr/local/Ascend/Ascend-Docker-Runtime/ascend-docker-runtime` | 文件存在且可执行 |
| containerd CRI 名为 `ascend` 的 runtime | `grep -A6 'runtimes.ascend' /etc/containerd/config.toml` | 存在且 `BinaryName` 指向 Ascend Docker Runtime |
| RuntimeClass | `kubectl get runtimeclass ascend` | `NAME=ascend`，`HANDLER=ascend` |
| containerd | `systemctl status containerd` | `active (running)` |

## 故障排查

### `--check` 校验失败

- 重新下载安装包，确认传输过程中未损坏
- 确认安装包与硬件型号、操作系统架构匹配

### npu-smi 无输出或报错

- 确认驱动与固件安装顺序正确（首次安装：驱动 → 固件）
- 确认 `HwHiAiUser` 用户已创建
- 检查内核头文件是否与当前内核一致：`uname -r`

### 容器无法使用 NPU

- 确认 `/etc/containerd/config.toml` 中 `runtime` 路径正确
- 确认已重启 containerd
- 查阅昇腾官方文档确认 CANN/驱动版本与容器镜像兼容
- 集群创建后的整卡 / 硬模板申请见 [昇腾 NPU 使用](../../../cluster-administration/npu-usage/)
- 硬切分 Pod 立刻失败、日志含 `create-vnpu`：对照 `template-info` 与 ConfigMap 模板名是否同为训练或同为推理
