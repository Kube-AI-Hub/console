# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01 容器组详情 · 事件

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `pod-events`
- **入口**: `{BASE_URL}/kube-frontend/public/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/pod-events.md`

## 产品功能

容器组详情展示该 Pod 的事件（类型/原因/消息/来源/次数/时间），倒序，条数等于接口过滤结果。

### 关联需求

- `prd/kube-frontend/app-workloads/pod-events.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/pod-events.md`](../../../../prd/kube-frontend/app-workloads/pod-events.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01** — 已知某容器组有事件，当打开其详情，则「事件」区块按时间倒序列出每条事件的类型、原因、消息、来源、重复次数与最近时间；条数等于 `events` 接口以 `involvedObject.name=<pod>,involvedObject.kind=Pod` 过滤后的条数；没有事件时显示说明；事件读取失败时只该区块降级。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/pod-events.md`](../../../../design/kube-frontend/app-workloads/pod-events.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/pod-events.md`](../../../../prd/kube-frontend/app-workloads/pod-events.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 这个容器组为什么起不来 (Priority: P1)

作为 **项目成员**，我希望 **在容器组详情看到该 Pod 的事件**，以便 **不必去命令行敲 `kubectl describe` 就能知道失败原因**。

**Independent Test**：打开一个有事件的 Pod 详情，核对事件条数等于该 Pod 的 events 接口返回条数。

## 前置与配置

- 已登录，且对 default 项目有读取权限
- 项目里至少有一个容器组

## 测试步骤

1. 用 API 取一个有事件的容器组，并按 involvedObject 过滤读其事件
2. 打开该容器组详情
3. 核对事件区块条数与接口一致
4. 核对首条原因出现在页面上

## 期望结果

- 事件区块存在
- 条数等于过滤后的接口条数
- 没有事件时显示说明

## 失败排查

- 事件区块为空但接口有条目：fieldSelector 少了一层（involvedObject.kind 必须一起给）
- 时间为空：只读了 lastTimestamp，事件可能只有 eventTime
- 区块不出现：只有 pods 详情渲染该区块

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py 与 WorkloadDetailPage.tsx
