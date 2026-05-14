---
title: "Time Synchronization Configuration"
keywords: 'Kubernetes, NTP, chrony, timesyncd, time synchronization, clock drift'
description: 'Unify timezone and configure time synchronization on all nodes before installing Kubernetes to avoid ServiceAccount token 401 errors, certificate verification failures, and other issues caused by clock drift.'
linkTitle: "Time Synchronization"
weight: 3160
---

In a Kubernetes cluster, all nodes must have consistent system times. Clock drift can lead to **ServiceAccount token authentication failures** (HTTP 401 when the cluster Service VIP load-balances across multiple apiserver replicas), certificate verification failures, inconsistent logs, and distributed transaction anomalies. Kube AI Hub Console provides a node time-sync monitoring panel to observe NTP status and clock offsets across nodes.

This guide describes how to configure consistent time synchronization and the `Asia/Shanghai` timezone on all cluster nodes.

## Prerequisites

- All nodes must have `systemd` installed and support the `timedatectl` command
- Nodes must have network connectivity to each other (**UDP 123** for NTP)
- `root` or `sudo` privileges

## Unified Timezone for All Nodes

Set the correct timezone on every node before installing Kubernetes.

### Check Current Timezone

```bash
timedatectl
```

Example output:

```
               Local time: Thu 2026-05-14 19:44:53 CST
           Universal time: Thu 2026-05-14 11:44:53 UTC
                 RTC time: Thu 2026-05-14 11:44:53
                Time zone: Asia/Shanghai (CST, +0800)
System clock synchronized: yes
              NTP service: active
          RTC in local TZ: no
```

### Set Timezone

```bash
sudo timedatectl set-timezone Asia/Shanghai
```

### Verify

```bash
timedatectl | grep "Time zone"
```

Expected output: `Time zone: Asia/Shanghai (CST, +0800)`. This takes effect immediately without a reboot.

## NTP Server Setup (Optional)

Set up dedicated NTP server(s) if you want an internal time source (for example, using control-plane nodes). **Skip this section if all nodes can directly access public NTP services (e.g., `ntp.aliyun.com`).**

### Install chrony

**RHEL / CentOS / Rocky / AlmaLinux**:

```bash
sudo yum install chrony -y
```

**Ubuntu / Debian**:

```bash
sudo apt update
sudo apt install chrony -y
```

### Configure the Server

Edit `/etc/chrony.conf`:

```bash
sudo vi /etc/chrony.conf
```

Example configuration:

```ini
# Upstream NTP servers
server ntp.aliyun.com iburst
server ntp.tencent.com iburst
server cn.pool.ntp.org iburst

# Allow clients from the cluster subnet
allow 10.2.0.0/16

# Deny all other clients
deny all

# Drift file
driftfile /var/lib/chrony/drift

# Allow fast step on large offsets
makestep 1.0 3

# Listen on all interfaces
bindcmdaddress 0.0.0.0
```

### Start and Enable

```bash
sudo systemctl enable chronyd
sudo systemctl start chronyd
```

### Firewall Configuration

Open **UDP 123**:

**firewalld**:

```bash
sudo firewall-cmd --add-service=ntp --permanent
sudo firewall-cmd --reload
```

**iptables**:

```bash
sudo iptables -A INPUT -p udp --dport 123 -j ACCEPT
```

**ufw (Ubuntu / Debian)**:

```bash
sudo ufw allow 123/udp
```

### Verify the NTP Server

Check synchronization with upstream:

```bash
sudo chronyc sources -v
```

Look for `^*` marking the current upstream source.

Test from another machine:

```bash
ntpdate -q 10.2.12.11
```

Example success output:

```
server 10.2.12.11, stratum 4, offset +0.000576, delay 0.02573
```

## Node Time Synchronization Client

**`systemd-timesyncd`** is recommended (included with `systemd`). Use the chrony client as an alternative if `timesyncd` is unavailable or finer control is needed.

### Check Current State

```bash
timedatectl
```

Key fields:

```
System clock synchronized: no
              NTP service: active
```

Continue configuration if `System clock synchronized` is `no`.

### Option A: systemd-timesyncd (Recommended)

#### Edit Configuration

```bash
sudo vi /etc/systemd/timesyncd.conf
```

Specify NTP servers in the `[Time]` section:

**Using an internal NTP server** (e.g., `10.2.12.11`):

```ini
[Time]
NTP=10.2.12.11
FallbackNTP=ntp.aliyun.com ntp.tencent.com
```

**Using public NTP servers**:

```ini
[Time]
NTP=ntp.aliyun.com ntp.tencent.com
FallbackNTP=cn.pool.ntp.org
```

#### Restart and Verify

```bash
sudo systemctl restart systemd-timesyncd
sudo systemctl enable systemd-timesyncd

# Check detailed sync status
timedatectl show-timesync --all
timedatectl
```

After 30-60 seconds, `System clock synchronized` should change to `yes`.

### Option B: chrony Client (Alternative)

```bash
# Install
sudo yum install chrony -y   # RHEL/CentOS
sudo apt install chrony -y   # Debian/Ubuntu

# Edit configuration
sudo vi /etc/chrony.conf
```

Add NTP server(s):

```ini
server 10.2.12.11 iburst
# Or use public servers
server ntp.aliyun.com iburst

driftfile /var/lib/chrony/drift
makestep 1.0 3
```

Start and check:

```bash
sudo systemctl enable chronyd
sudo systemctl start chronyd
chronyc tracking
chronyc sources -v
```

## Verify Kernel Time Sync Flag

For Kubernetes nodes, the system time must be correct **and** the kernel's `STA_UNSYNC` flag must be cleared (i.e., the `node_timex_sync_status` metric must be **1**). This metric is collected by Prometheus + node_exporter and displayed in the Kube AI Hub Console cluster nodes page.

### Using timedatectl

```bash
timedatectl
```

Ensure:

- `System clock synchronized: yes`
- `NTP service: active`

> When using chrony, `NTP service` may show `n/a`. Use `System clock synchronized` to verify.

### Using adjtimex (Optional)

```bash
# Install
sudo yum install adjtimex   # CentOS/RHEL
sudo apt install adjtimex   # Debian/Ubuntu

# Check status
sudo adjtimex --print | grep status
```

### Verifying via node_exporter Metrics

```bash
curl -s http://localhost:9100/metrics | grep node_timex_sync_status
```

Expected output: `node_timex_sync_status 1`

## Troubleshooting

### Clock Remains Unsynchronized

- Check firewall: ensure **UDP 123** from client to NTP server is open.
- Verify the NTP server: `ntpdate -q <server IP>`.
- For timesyncd, check logs: `journalctl -u systemd-timesyncd -f`.
- Retry manually:

```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```

### Large Offset, Slow Convergence

- chrony slews gradually by default. To allow an immediate step:

```bash
sudo chronyc makestep
```

- timesyncd converges slowly on large offsets; consider switching to the chrony client.

### Timezone Change Does Not Take Effect

- Verify `/etc/localtime` symlink:

```bash
ls -l /etc/localtime
```

- Reapply if manually modified:

```bash
sudo timedatectl set-timezone Asia/Shanghai
```

### Clock Drift Between Nodes

- In Kube AI Hub Console, check the **Time Sync/NTP** column on the cluster nodes list page. It shows each node's offset from the cluster median (**> 30s** warning, **> 120s** critical).
- Ensure all nodes use the same upstream NTP server.
- For nodes with severe drift, sync manually or restart the time service, using a correctly-synchronized node as reference.

## Command Quick Reference

| Operation | Command |
|-----------|---------|
| Check timezone and sync status | `timedatectl` |
| Set timezone | `sudo timedatectl set-timezone Asia/Shanghai` |
| Enable NTP sync | `sudo timedatectl set-ntp true` |
| Restart timesyncd | `sudo systemctl restart systemd-timesyncd` |
| View chrony sources | `chronyc sources -v` |
| View chrony tracking | `chronyc tracking` |
| Test NTP server connectivity | `ntpdate -q <IP>` |
| View kernel clock flags | `sudo adjtimex --print \| grep status` |
| Query node_exporter time sync metric | `curl -s http://localhost:9100/metrics \| grep node_timex_sync_status` |
