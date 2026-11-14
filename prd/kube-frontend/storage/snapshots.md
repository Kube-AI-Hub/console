# 卷快照与快照类型（L3）

[子模块需求](./_index.md)

## 概述

老 console 的「存储」在集群视角有两页：全部项目的卷快照（VolumeSnapshot）与集群的快照类型（VolumeSnapshotClass）。新 UI 已有项目级「存储卷快照」，但没有跨项目视图，也没有快照类型的入口。

本功能点补上集群级两页：`/kube-frontend/clusters/<cluster>/volume-snapshots`（名称、项目、状态、容量、快照类型、创建时间，项目列与名称链回项目控制台）与 `/kube-frontend/clusters/<cluster>/volume-snapshot-classes`（名称、驱动、删除策略、参数个数、创建时间）。两页只读：快照的创建、恢复、删除仍留在项目控制台或安装器。

## 用户故事

### US1 - 在集群视角查看卷快照与快照类型 (Priority: P1)

作为 **集群运维**，我希望 **在一个跨项目的列表里看到全部卷快照的归属与状态，并看到集群的快照类型**，以便 **不必逐个进入项目排查「哪个项目的快照没就绪」，也能确认快照驱动是否配置正确**。

**Independent Test**：打开集群级卷快照页，核对六列与项目链接；打开快照类型页，核对五列；当集群没有装快照 CRD 时，两页都给出明确说明。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01** — 已知集群已安装 CSI 快照 CRD，当打开 `/volume-snapshots`，则显示跨项目卷快照表（名称、项目、状态、容量、快照类型、创建时间），行数等于 `min(20, 总数)`，名称链到该快照在项目控制台的详情、项目列链到该项目的卷快照列表；当打开 `/volume-snapshot-classes`，则显示快照类型表（名称、驱动、删除策略、参数个数、创建时间），行数等于 `min(20, 总数)`；已知集群未安装 `snapshot.storage.k8s.io/v1`，则两页都显示「本集群未安装快照 CRD」的明确说明，而不是空表。

## 设计目标

- 集群视角一屏回答「哪个项目的哪个快照出问题」，并把读者带回项目控制台。
- 两页在 CRD 缺失时给出可操作的说明（缺什么、装了之后会显示什么），而不是一个会被读成「没有数据」的空表。
- 复用集群级列表已有的分页/搜索/排序/空态骨架，两页保持与集群存储卷声明一致的交互。

## 约束与边界

- 只读页面：不创建、恢复或删除快照，也不创建快照类型（属于安装器 / 项目控制台）。
- 数据来源是 kapis 通用资源代理与 kube discovery，不新增 api-client 方法。
- 集群页的「项目」来自对象的 `metadata.namespace`；企业空间通过集群项目索引解析后拼进项目控制台 URL。
- 分页固定 20 行一页，与集群存储卷声明页一致。

## UI 交互设计

两页都是「标题 + 搜索 + 表格 + 分页」：

- `/volume-snapshots`：名称（链接）、项目（链接）、状态徽章、容量、快照类型、创建时间；行句柄为 `<项目>/<名称>`。
- `/volume-snapshot-classes`：名称、驱动、删除策略、参数个数、创建时间；行句柄为类名。
- 空态：卷快照显示「暂无存储卷快照」，快照类型显示「暂无快照类型」。
- CRD 缺失态：一块说明卡片（标题 + 说明 + `snapshot.storage.k8s.io/v1`），`data-ai-state="empty"`。
- 页面句柄：`cluster-volume-snapshots:surface`、`cluster-snapshot-classes:surface`；CRD 缺失说明块为 `*-crd-missing`。

## 文案与校验

- 列名：名称、项目、状态、容量、快照类型、创建时间；名称、驱动、删除策略、参数个数、创建时间。
- 状态：Ready → 就绪，Pending → 等待中，Error 保留 API 原值（不猜译）。
- 搜索占位符沿用集群页的「按名称搜索」。
- CRD 缺失标题：「本集群未安装快照 CRD」。

## 边界情况

- 集群没有快照对象、也没有快照类型：正常空态，不是 CRD 缺失态。
- CRD 缺失：discovery 返回 404 时进入缺失态；403（无权限）仍按错误处理并给重试，不伪装成「未安装」。
- 快照未就绪（`readyToUse` 为 false）且带 `status.error`：状态显示 Error，徽章为危险色。
- 快照没有显式类名（使用默认类）：快照类型列显示 `-`。
- 快照类型没有 `parameters`：参数个数为 0。
- 搜索无结果：空态标题不变，分页显示 0 条。

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01** — 集群级卷快照列表：六列、跨项目、项目链接与名称链接。
- **FR-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-02** — 集群级快照类型列表：五列。
- **FR-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-03** — 两页在快照 CRD 缺失时显示明确说明；探测走 `snapshot.storage.k8s.io/v1` 的 discovery，仅 404 视为未安装。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01** — 两页首屏骨架 200 ms 内出现，数据就绪后不出现空白表格。
- **SC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-02** — 未安装快照 CRD 的集群上，两页都能从说明文字判断「缺组件」而非「没有快照」。

## 明确不做

- 不做 VolumeSnapshotContent（快照内容）独立视图：老 console 用它对账底层内容，但本轮两个列表已能回答运维问题；它对 agent 与人工都属于深链场景，登记为后续改进。
- 不做 `/snapshots` 别名路由：旧收藏的别名不在新导航里，registry 未登记，新增别名只会多一个需要维护的入口。
- 不做快照的创建 / 恢复 / 删除，也不做快照类型的创建：这些是写操作，写路径尚未在此区域迁移。
- **探测证据（2026-11-14，host 集群，BFF:8092）**：`GET /apis/snapshot.storage.k8s.io/v1` → 200（API 组存在）；`GET /apis/snapshot.storage.k8s.io/v1/volumesnapshots` → 200、items=0；`.../volumesnapshotclasses` → 200、items=0；`.../volumesnapshotcontents` → 200、items=0；`GET /kapis/resources.kubesphere.io/v1alpha3/volumesnapshots?page=1&limit=20` → 200、totalItems=0；classes 同理。结论：**本集群安装了 CRD 但尚无对象**，页面走正常空态；「未安装」分支由 discovery 404 触发（当前环境无法直接观察，代码路径已按 404 实现并由用例的缺 CRD 分支断言文案）。

## 假设

- CSI 快照组件安装后，VolumeSnapshot / VolumeSnapshotClass 会出现在 kube API 与 kapis 通用资源代理中。
- 集群规模下快照数量在分页范围内可接受（每页 20 条，服务端分页）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01`
