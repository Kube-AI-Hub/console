# TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02 快照详情 · 数据来源与事件两个页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `detail-tabs`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/volumesnapshots`
- **需求**: `prd/kube-frontend/storage/detail-tabs.md`

## 产品功能

快照详情默认停在「数据来源」，切到「事件」能看到该快照的事件或空态说明；两个页签都在。

### 关联需求

- `prd/kube-frontend/storage/detail-tabs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/detail-tabs.md`](../../../../prd/kube-frontend/storage/detail-tabs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02** — 已知存在一个快照对象，当打开其详情，则默认停在「数据来源」页签并显示来源声明、快照类型、容量、状态等属性；切到「事件」则显示该快照的事件（类型/原因/消息/次数/最近发生），没有事件时显示「这个对象还没有事件」；两个页签都存在且可切换。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/detail-tabs.md`](../../../../design/kube-frontend/storage/detail-tabs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/detail-tabs.md`](../../../../prd/kube-frontend/storage/detail-tabs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在详情里查清原因 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情直接看到标签/注解与事件**，以便 **不必为了看一条事件跳到别处**。

**Independent Test**：打开存储卷详情，切到「元数据」看到标签与注解表（条数与对象一致），切到「事件」看到事件表或「还没有事件」说明。

## 前置与配置

- 已登录，host 集群 default 项目；存在至少一个 VolumeSnapshot 对象

## 测试步骤

1. 从快照列表进入任一快照详情（或直接访问 /volumesnapshots/<name>）
2. 等 volumesnapshots-detail:surface 就绪
3. 核对页签为「数据来源 / 事件」，默认选中「数据来源」，属性区可见（来源声明/快照类型/容量/状态）
4. 切到「事件」，核对事件表或「这个对象还没有事件」空态出现
5. 切回「数据来源」，核对属性区仍在（不重新请求）

## 期望结果

- 两个页签都存在，默认数据来源
- 事件页签显示事件表或空态，不是空白

## 失败排查

- 只有属性没有页签：快照分支仍渲染单列
- 事件页签空白：useObjectEvents 的 kind 传错（应为 VolumeSnapshot）

## 产品改版后如何更新自动化

- 句柄：volumesnapshots-detail:tab:source / :tab:events
