# 列表实时刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/live-watch.md)

## 概述

`packages/api-client/src/watch.ts` 的 `watchCollection` + `apps/console-next/src/components/resource/useCollectionWatch.ts`，接到集群级容器组列表。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01

## 设计目标与非目标

目标：按需实时、断线自愈、只有一份列表实现。非目标：增量合并、多列表默认开启。

## 关键约束

- watch 是普通分块 HTTP（`?watch=true`），BFF 的流式代理直接透传，不需要 WebSocket upgrade。
- 事件是逐行 JSON；chunk 边界会切断 JSON，必须缓冲到换行再解析。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01 — 变更即失效重取，不重建行

**为什么**：列表已有排序/分页/映射，重建行等于第二份实现；收到事件只 `invalidateQueries`。

**被否方案**：把事件对象映射成行并插入当前页——分页条件下插入位置本身是错的。

**何时重新考虑**：需要「不闪屏的原地更新」时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-02 — 用 HTTP 流而不是 WebSocket

**为什么**：kube watch 是分块 HTTP，BFF 代理已透传，浏览器 fetch 能读 ReadableStream；WebSocket 要多一条升级通道，收益为零。

**被否方案**：复用 exec 的 upgrade 通道做 watch。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-03 — dev 代理的长连接必须能取消且不占短请求的连接池

**为什么**：代理原先 32 连接池被不结束的 watch/日志 tail 占满后，整个 `/api` 排队挂起；且中止时只销毁 Node 流、不 abort undici 请求，socket 逐个泄漏直至进程停止响应。修复：长连接走独立无上限 dispatcher，并在客户端断开时 abort 上游 fetch。

**被否方案**：把全局池调大——只是把「多快挂」换成「多慢挂」。

## 系统现状

老 console 用推送刷新列表；新 UI 此前只有手动刷新按钮。

## 仓库落点

- 客户端：`packages/api-client/src/watch.ts`
- Hook：`apps/console-next/src/components/resource/useCollectionWatch.ts`
- 页面：`apps/console-next/src/pages/cluster/ClusterPodsPage.tsx`
- 开发代理：`kube-frontend/scripts/dev-static-server.mjs`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 容器组 watch | /api/v1/pods?watch=true |

## 不变量

1. 默认关闭；关闭即 abort。
2. 重连退避 1s 起、×2、上限 30s。
3. 只有一份列表实现。

## 已知坑

- **不能把 connecting 当失败**：没有变更事件时也要显示「实时更新中」，连接建立即标记（onOpen），不要等第一条事件。
- **块边界**必须缓冲到换行，否则 JSON 被截断。
- **queryKey 要按值比较**：用数组引用做 effect 依赖会在每次渲染断开重连。
- **dev 代理**：长连接与短请求分开池，且中止时要 abort 上游 fetch，否则 socket 泄漏。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01.yaml`
可观测点：`cluster-pods:live`（aria-pressed）、`cluster-pods:live-state`。

## 后续改进

- 其余列表接入同一 hook。
- 需要原地更新时再考虑增量合并。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01
