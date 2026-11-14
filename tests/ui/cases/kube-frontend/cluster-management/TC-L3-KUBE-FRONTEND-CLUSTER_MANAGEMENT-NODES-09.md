# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-09 节点列表 · 指标和列显隐

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

节点指标使用正确单位和全局 NTP 口径。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-09** — 列表批量读取 GPU/显存、CPU/内存和容器组的比率及绝对量，GPU/CPU/内存分配量独立显示；显存 bytes 换算 GiB。显示厂商、型号、当前模式及相对整个基础范围时间中位数的 NTP 偏移；30 秒警告、120 秒危险。缺失或零分母显示 `-`，指标失败不阻断操作。名称和行操作不可隐藏，其余列可隐藏并恢复；1024/1280/1600 下横向滚动限于表格。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认节点是否就绪、还剩多少资源 (Priority: P1)

作为 **集群管理员**，我希望 **一眼看到每个节点的就绪状态与可分配资源**，以便 **判断能否继续调度**。

**Independent Test**：打开节点页，核对状态徽章与 `kubectl get nodes` 的 STATUS 列一致。

### US6 - 查找节点并比较设备负载 (Priority: P1)

作为 **集群管理员**，我希望 **按状态、角色、厂商及型号查找节点并比较 GPU 与容器组负载**，以便 **在集群总览不变的情况下选择目标节点**。

**Independent Test**：搜索无匹配名称，统计仍与全局接口一致；组合筛选、分页与列显隐可恢复，指标与同次采样一致。

## 前置与配置

- B200 节点监控接口具有 GPU、显存、CPU、内存和容器组采样

## 测试步骤

1. 捕获同次监控响应，逐行核对比率、绝对量、分配量和 GiB
2. 核对厂商、型号、模式及全局时间中位数偏移
3. 在 1024/1280/1600 视口截图，隐藏显存列并恢复

## 期望结果

- 数值与采样一致，显存不误用 MiB 口径
- 表格横向滚动不撑宽页面，列显隐可恢复

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
