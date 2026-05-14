---
title: "时间同步配置"
keywords: 'Kubernetes, NTP, chrony, timesyncd, 时间同步, clock drift, 时钟偏差'
description: '在安装 Kubernetes 前统一所有节点时区并配置时间同步服务，避免集群运行时出现节点间时钟偏移导致 ServiceAccount token 401、证书验证失败等问题。'
linkTitle: "时间同步"
weight: 3160
---

在 Kubernetes 集群中，所有节点的时间必须保持高度一致，否则可能导致 **ServiceAccount token 认证失败**（经集群 Service VIP 轮询多副本 apiserver 时出现 401）、证书验证失败、日志混乱、分布式事务异常等问题。Kube AI Hub Console 提供了节点时间同步监控面板，用于观测各节点的 NTP 状态与时钟偏差。

本文档介绍如何为集群所有节点配置一致的时间同步服务和 `Asia/Shanghai` 时区。

## 前提条件

- 所有节点均安装 `systemd` 并支持 `timedatectl` 命令
- 节点间网络互通（**UDP 123** 端口用于 NTP）
- 具有 `root` 或 `sudo` 权限

## 统一时区为 Asia/Shanghai

安装 Kubernetes 之前，在每个节点上设置正确的时区。

### 检查当前时区

```bash
timedatectl
```

输出示例：

```
               Local time: Thu 2026-05-14 19:44:53 CST
           Universal time: Thu 2026-05-14 11:44:53 UTC
                 RTC time: Thu 2026-05-14 11:44:53
                Time zone: Asia/Shanghai (CST, +0800)
System clock synchronized: yes
              NTP service: active
          RTC in local TZ: no
```

### 设置时区

```bash
sudo timedatectl set-timezone Asia/Shanghai
```

### 验证

```bash
timedatectl | grep "Time zone"
```

应输出：`Time zone: Asia/Shanghai (CST, +0800)`。修改后无需重启，立即生效。

## NTP 服务器搭建（可选）

如果集群内部希望有一台或多台专用的 NTP 服务器（例如以控制平面节点兼任），请按本节配置。**所有节点均可直接访问公网 NTP 服务（如 `ntp.aliyun.com`）时，可跳过此节，直接进入「节点时间同步客户端」。**

### 安装 chrony

**RHEL / CentOS / Rocky / AlmaLinux**：

```bash
sudo yum install chrony -y
```

**Ubuntu / Debian**：

```bash
sudo apt update
sudo apt install chrony -y
```

### 配置 chrony 服务端

编辑 `/etc/chrony.conf`：

```bash
sudo vi /etc/chrony.conf
```

配置示例（内部服务器 IP 为例）：

```ini
# 上游时间服务器
server ntp.aliyun.com iburst
server ntp.tencent.com iburst
server cn.pool.ntp.org iburst

# 允许集群网段内的客户端访问本 NTP 服务器
allow 10.2.0.0/16

# 禁止所有其他客户端
deny all

# 记录漂移文件
driftfile /var/lib/chrony/drift

# 较大偏差时允许快速调整
makestep 1.0 3

# 监听所有网络接口
bindcmdaddress 0.0.0.0
```

### 启动并启用

```bash
sudo systemctl enable chronyd
sudo systemctl start chronyd
```

### 防火墙配置

开放 **UDP 123** 端口：

**firewalld**：

```bash
sudo firewall-cmd --add-service=ntp --permanent
sudo firewall-cmd --reload
```

**iptables**：

```bash
sudo iptables -A INPUT -p udp --dport 123 -j ACCEPT
```

**ufw（Ubuntu / Debian）**：

```bash
sudo ufw allow 123/udp
```

### 验证 NTP 服务器

检查本机与上游同步状态：

```bash
sudo chronyc sources -v
```

输出中标记 `^*` 的为当前同步的上游源。

从另一台机器验证：

```bash
ntpdate -q 10.2.12.11
```

成功示例输出：

```
server 10.2.12.11, stratum 4, offset +0.000576, delay 0.02573
```

## 节点时间同步客户端

推荐使用 **`systemd-timesyncd`**（系统自带，无需安装额外软件）。如系统无此工具或需要更精细控制，可改用 **chrony 客户端**。

### 检查当前状态

```bash
timedatectl
```

重点关注：

```
System clock synchronized: no
              NTP service: active
```

如 `System clock synchronized` 为 `no`，需要继续配置。

### 方案 A：systemd-timesyncd（推荐）

#### 编辑配置

```bash
sudo vi /etc/systemd/timesyncd.conf
```

在 `[Time]` 段指定 NTP 服务器：

**使用内部 NTP 服务器**（例如 `10.2.12.11`）：

```ini
[Time]
NTP=10.2.12.11
FallbackNTP=ntp.aliyun.com ntp.tencent.com
```

**直接使用公网 NTP 服务器**：

```ini
[Time]
NTP=ntp.aliyun.com ntp.tencent.com
FallbackNTP=cn.pool.ntp.org
```

#### 重启并验证

```bash
sudo systemctl restart systemd-timesyncd
sudo systemctl enable systemd-timesyncd

# 查看详细同步状态
timedatectl show-timesync --all
timedatectl
```

等待 30-60 秒后，`System clock synchronized` 应变为 `yes`。

### 方案 B：chrony 客户端（备选）

```bash
# 安装
sudo yum install chrony -y   # RHEL/CentOS
sudo apt install chrony -y   # Debian/Ubuntu

# 编辑配置
sudo vi /etc/chrony.conf
```

添加 NTP 服务器：

```ini
server 10.2.12.11 iburst
# 或使用公网
server ntp.aliyun.com iburst

driftfile /var/lib/chrony/drift
makestep 1.0 3
```

启动并检查：

```bash
sudo systemctl enable chronyd
sudo systemctl start chronyd
chronyc tracking
chronyc sources -v
```

## 验证内核时间同步标志

对于 Kubernetes 节点，不仅需要系统时间正确，还需要内核的 **`STA_UNSYNC` 标志被清除**（即 `node_timex_sync_status` 指标为 **1**）。该指标由 Prometheus + node_exporter 采集后，在 Kube AI Hub Console 的集群节点页面展示。

### 使用 timedatectl

```bash
timedatectl
```

确保：

- `System clock synchronized: yes`
- `NTP service: active`

> 使用 chrony 时 `NTP service` 可能显示为 `n/a`，但同步状态仍由 `System clock synchronized` 判断。

### 使用 adjtimex（可选）

```bash
# 安装
sudo yum install adjtimex   # CentOS/RHEL
sudo apt install adjtimex   # Debian/Ubuntu

# 查看状态
sudo adjtimex --print | grep status
```

### 通过 node_exporter 指标验证

```bash
curl -s http://localhost:9100/metrics | grep node_timex_sync_status
```

期望输出：`node_timex_sync_status 1`

## 故障排查

### 同步状态始终为 no

- 检查防火墙：客户端到 NTP 服务器的 **UDP 123** 端口是否开放。
- 检查 NTP 服务器是否正常工作：`ntpdate -q <服务器 IP>`。
- 使用 timesyncd 时查看日志：`journalctl -u systemd-timesyncd -f`。
- 手动重试：

```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```

### 时间跳变较大导致同步慢

- chrony 默认逐渐微调（slew），可临时允许跳跃：

```bash
sudo chronyc makestep
```

- timesyncd 对大幅度偏移收敛较慢，可考虑改用 chrony 客户端。

### 时区修改后不生效

- 确认 `/etc/localtime` 是否正确链接：

```bash
ls -l /etc/localtime
```

- 如手动修改过，重新执行：

```bash
sudo timedatectl set-timezone Asia/Shanghai
```

### 节点间时间不一致

- 在 Kube AI Hub Console 的 **集群节点列表** 中查看「时间同步/NTP」列，比较各节点与集群中位数的偏差（偏差超过 **30s** 显示警告，超过 **120s** 显示严重）。
- 确认所有节点使用同一上游 NTP 服务器。
- 严重时钟偏差时，以「正确时间」节点为依据，在偏差节点上手动同步或重启 time 服务。

## 参考命令速查表

| 操作 | 命令 |
|------|------|
| 查看时区和同步状态 | `timedatectl` |
| 设置时区 | `sudo timedatectl set-timezone Asia/Shanghai` |
| 开启 NTP 同步 | `sudo timedatectl set-ntp true` |
| 重启 timesyncd | `sudo systemctl restart systemd-timesyncd` |
| 查看 chrony 同步源 | `chronyc sources -v` |
| 查看 chrony 同步状态 | `chronyc tracking` |
| 检查 NTP 服务器连通性 | `ntpdate -q <IP>` |
| 查看内核时钟标志 | `sudo adjtimex --print \| grep status` |
| 获取 node_exporter 时间同步指标 | `curl -s http://localhost:9100/metrics \| grep node_timex_sync_status` |
