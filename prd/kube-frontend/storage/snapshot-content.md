# 快照内容视图（L3）

[子模块需求](./_index.md)

## 概述

集群级 `/volume-snapshot-content/<name>`：一条 VolumeSnapshotContent 的只读详情——CSI 驱动、真实快照句柄（snapshotHandle）、所属快照、恢复大小、可恢复状态与删除策略。

老 console 有这一页（`Storage/VolumeSnapshots/SnapshotContent/Detail`）。它回答的是排障的最后一环：**「快照对象说有了，卷上到底有没有」**。列表页只能显示快照对象的状态，句柄在内容对象上。

## 用户故事

### US1 - 从快照追到后端真实句柄 (Priority: P2)

作为 **存储运维**，我希望 **看到快照对应的后端句柄与驱动**，以便 **判断快照是真存在还是只有对象**。

**Independent Test**：打开一条快照内容的详情，核对驱动/句柄/恢复大小与 `volumesnapshotcontents` 对象一致；打开不存在的名字时得到明确的「不存在」提示。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01** — 已知集群存在/不存在快照内容，当访问 `/clusters/<c>/volume-snapshot-content/<name>`，则存在时显示驱动、快照句柄、所属快照（项目/名称）、恢复大小、可恢复、删除策略与创建时间；不存在时显示「这条快照内容不存在」而不是空白页。

## UI 交互设计

- 标题为内容对象名；下方一组 label/value 行（等宽显示句柄）。
- 不存在时显示错误面板与重试。

## 文案与校验

- 不存在：「这条快照内容不存在（可能已随快照释放）。」
- 空值显示 `-`。

## 边界情况

- 内容对象存在但 `snapshotHandle` 为空（预供给/未绑定）：显示 `-`，不隐藏该行。
- 成员集群：本页读原生组，不带 kapis 的 clusters 段；已在存储快照页的已知坑里记过同一判断。

## 明确不做

- 编辑或删除快照内容：由 CSI 控制器管理，控制台写入会绕过它的状态机。
- 从快照恢复：需要 PVC 创建流程与数据源选择，属另一功能。

## 假设

- 快照 CRD（`snapshot.storage.k8s.io/v1`）已安装；未安装时页面显示接口错误。

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01** — 只读展示快照内容的关键字段。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01** — 字段值与对象一致；不存在的名字有明确提示。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01`
