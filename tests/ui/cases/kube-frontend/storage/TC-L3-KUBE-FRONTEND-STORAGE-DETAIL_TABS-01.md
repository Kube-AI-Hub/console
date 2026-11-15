# TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01 存储详情的元数据与事件页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `detail-tabs`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/detail-tabs.md`

## 产品功能

存储卷详情的四个页签：属性/元数据/事件/快照；元数据只读、事件独立三态。

### 关联需求

- `prd/kube-frontend/storage/detail-tabs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/detail-tabs.md`](../../../../prd/kube-frontend/storage/detail-tabs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01** — 已知存在一个带标签与注解的存储卷，当打开其详情并切到「元数据」，则标签表与注解表的行数分别等于对象 metadata.labels 与 metadata.annotations 的条数，键值原样显示；切到「事件」则显示该 PVC 的事件（类型/原因/消息/次数/最近发生），没有事件时显示「这个对象还没有事件」；四个页签（属性/元数据/事件/快照）都存在且可切换。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/detail-tabs.md`](../../../../design/kube-frontend/storage/detail-tabs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/detail-tabs.md`](../../../../prd/kube-frontend/storage/detail-tabs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在详情里查清原因 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情直接看到标签/注解与事件**，以便 **不必为了看一条事件跳到别处**。

**Independent Test**：打开存储卷详情，切到「元数据」看到标签与注解表（条数与对象一致），切到「事件」看到事件表或「还没有事件」说明。

## 前置与配置

- 已登录；存在带标签与注解的存储卷

## 测试步骤

1. 打开该存储卷详情
2. 核对四个页签
3. 切到元数据，核对标签/注解行数
4. 切到事件，核对事件表或空态

## 期望结果

- 元数据页签只读（无编辑控件）

## 失败排查

- 事件一直为空：该对象确实没有事件
- 注解很多时被截断：应原样换行显示

## 产品改版后如何更新自动化

- 选择器：storage-detail:tab:metadata / storage-detail:tab:events / storage-detail:labels / storage-detail:annotations / storage-detail:events
