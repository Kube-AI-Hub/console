# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03 容器详情 · 实时日志 tail

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/kubesphere-system/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

容器详情「日志」区块的「实时」开关：打开后从最近 1 小时的搜索结果切换为 kube log 子资源的流式读取（HTTP chunked），新行追加在底部、最多 1000 行；停止后不再追加，断开可重连。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03** — 已知容器有日志，当打开该容器详情页并打开「日志」区块的「实时」开关，则日志区块从最近 1 小时的搜索结果切换为实时流，新行追加在底部（最多保留 1000 行），连接中与已断开各有明确提示；关闭开关或点「停止实时」后不再追加新行，断开时可点「重新连接」重建流；开关关闭时原有日志搜索行为不变。

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
2. 打开该容器详情页，确认实时流列表还不存在、开关为关
3. 点「实时」开关
4. 等待流列表出现且 data-ai-state 变为 ready，行数 >= 1 且 <= 1000
5. 点「停止实时」，确认开关回到关、流列表消失、关键字输入框回到搜索视图
6. 再点一次「实时」，确认能重新建立流且再次出现日志行

## 期望结果

- 实时流列表出现且至少 1 行，超过 1000 行时只保留最新 1000 行
- 停止后开关 aria-checked=false，流列表从页面移除，不再追加
- 关闭时日志搜索区块与关键字输入框恢复；再次打开能重连

## 失败排查

- 一直停在「正在连接日志流…」：该容器日志不足 4 KB，upstream 不 flush 响应头（见技术方案已知坑）；这不是页面缺陷，换日志量大的容器
- 开关点了没反应：radix Switch 的点击目标是 [role="switch"]，不是外层的 data-ai-id 容器
- {'流列表空但开关已开：先看 network 里 /log?follow=true 是否 200 且 Transfer-Encoding': 'chunked'}

## 产品改版后如何更新自动化

- 选择器见 ContainerDetailPage.tsx：container-detail:log-follow / log-stream / log-stream-list / log-stream-stop / log-stream-retry
