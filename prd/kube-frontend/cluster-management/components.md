# 系统组件（L3）

[子模块需求](./_index.md)

## 概述

平台各组件的健康状态：名称（副行为命名空间）、健康后端数、启动时间；不健康的排在前面。

## 用户故事

### US1 - 一眼看出哪个组件不正常 (Priority: P1)

作为 **集群管理员**，我希望 **异常组件排在列表最前**，以便 **不必在几十个组件里逐个对照数字**。

**Independent Test**：打开系统组件页，核对首行是健康数不等于总数的组件。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01** — 已知平台有多个组件，当打开系统组件页，则显示名称、健康后端、启动时间三列；健康后端显示为 `健康/总数`，无后端的组件显示「无后端」；不健康的组件排在健康的组件之前。概览 type 分类链接按六类 namespace 过滤，组件分类可清除；读取和详情缓存含当前 cluster，成员集群不回退 host。

## 设计目标

把「哪个不正常」放在读者第一眼看得到的位置。

## 约束与边界

- 数据来自 `kapis/resources.kubesphere.io/v1alpha3/components`，该接口返回**裸数组**而非 `{items}` 包装。
- 只读。

## UI 交互设计

健康徽标：全部健康为成功色，否则危险色；无后端也是危险色（表示组件没有起来）。

## 文案与校验

- 列：名称、健康后端、启动时间。
- 无后端：无后端。

## 边界情况

- 组件无 `totalBackends` 时按 0 处理，显示「无后端」而不是 `0/0`。

## 明确不做

- 组件重启、日志查看（属运维操作）。
- 不做分组折叠的第二套列表；原“不分类”判断被概览复盘推翻，现复用同一列表加分类筛选。

## 假设

- 接口在版本升级后仍返回数组；若改为包装结构，读取端两种形状都接受。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01** — 三列展示，不健康优先排序。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-02** — 兼容数组与 `{items}` 两种响应。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01** — 组件数与接口返回一致。
