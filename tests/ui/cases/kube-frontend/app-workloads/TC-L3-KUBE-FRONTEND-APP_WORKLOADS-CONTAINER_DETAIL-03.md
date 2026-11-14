# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03 容器详情 · 实时日志 tail

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/kubesphere-system/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

近全屏日志弹窗在历史搜索与 HTTP 实时流之间切换，保留格式并在关闭时取消连接。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03** — 日志弹窗的「实时」开关切换到流式日志；保留最近 1000 行滚动历史，连接与断开状态可见，刷新可重连。关闭开关恢复搜索模式，关闭弹窗立即取消日志流。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

## 前置与配置

- 已登录
- kubesphere-system 下存在「当前日志足够大、upstream 会立即开始 tail」的容器（用例先用 API 探到并跳过不满足的环境）

## 测试步骤

1. 用 API 选一个当前日志量足够、follow 请求会立即返回响应头的容器组与容器
2. 打开该容器详情页并点日志控制台，确认实时流还不存在、开关为关
3. 点「实时」开关
4. 等待日志控制台状态变为 ready，模拟器内出现非空日志内容
5. 关闭日志弹窗，确认流消失
6. 重新打开日志弹窗，默认搜索模式，切换实时后再次出现日志内容

## 期望结果

- 实时日志内容非空，滚动历史上限由模拟器配置为 1000 行
- 关闭弹窗后流移除且连接取消
- 再次打开恢复搜索模式并可重新连接实时流

## 失败排查

- 一直停在「正在连接日志流…」：该容器日志不足 4 KB，upstream 不 flush 响应头（见技术方案已知坑）；这不是页面缺陷，换日志量大的容器
- 开关点了没反应：radix Switch 的点击目标是 [role="switch"]，不是外层的 data-ai-id 容器
- {'流列表空但开关已开：先看 network 里 /log?follow=true 是否 200 且 Transfer-Encoding': 'chunked'}

## 产品改版后如何更新自动化

- 选择器见 ContainerLogsDialog.tsx，状态在 log-console，内容为模拟器 xterm-rows
