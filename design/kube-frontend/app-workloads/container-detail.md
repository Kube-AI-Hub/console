# 容器详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/container-detail.md)

## 概述

从容器组对象派生单个容器的视图并分区展示，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02

## 设计目标与非目标

目标：一屏回答「这个容器配置成什么样」。非目标：日志、终端、单容器监控、容器编辑。

## 关键约束

- 数据源只有容器组对象：`spec.containers[]`、`spec.volumes[]`、`status.containerStatuses[]`。
- 路由：`…/pods/$name/containers/$container`，挂在容器组详情之下。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01 — 视图在页面内派生，不进 api-client

**为什么**：容器不是一个可寻址的资源，没有自己的接口；它是容器组对象的一段。为它造 `containerApi` 会暗示「可以单独获取/修改容器」，与事实不符。派生函数与页面同文件，类型也只在本页使用。
**被否方案**：在 api-client 里加 `toContainerView`。收益是跨页复用，但这个视图只有一个使用者。
**何时重新考虑**：出现第二个需要「同一份容器视图」的页面时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02 — 不做日志/终端/监控页签

**为什么**：老 console 的三个页签分别依赖流式日志接口、WebSocket exec、监控区间查询；本控制台的 BFF 只代理普通 HTTP，没有这些端点。做出来只能是「点了报错」或「永远转圈」。
**被否方案**：保留页签并显示「暂不可用」。那比没有页签更糟——读者会反复点。
**何时重新考虑**：BFF 增加 exec/流式代理时（届时三件事一起做）。

## 系统现状

老 console：`/pods/:podName/containers/:containerName`，四个页签（资源状态/监控/环境变量/日志）。本页迁出「资源状态 + 环境变量」并补齐挂载、端口、探针；监控与日志按上面的决策不做。

## 仓库落点

- 页面：`apps/console-next/src/pages/app-workloads/ContainerDetailPage.tsx`
- 路由：`routes/…/pods/$name/containers/$container.tsx`（容器组详情由 `$name.tsx` 改造为 `$name/` 目录，index 即原详情）
- 容器组详情的容器区块：`WorkloadDetailPage.tsx`（仅 pods 提供容器链接）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 容器组 | /kapis/resources.kubesphere.io/v1alpha3/namespaces/&lt;ns&gt;/pods/&lt;name&gt;（含 spec/status） |

## 不变量

1. 容器视图全部字段来自容器组对象，不额外请求。
2. 五个区块能把「空」与「有内容」区分开。
3. 容器名不在对象里时显示明确提示，而不是空白页。

## 已知坑

- **`$name.tsx` 与 `$name/` 不能共存**：容器详情要挂在容器组详情之下，必须把 `$name.tsx` 改成 `$name/{route,index}.tsx`，否则路由树冲突；改完要重新 `vite build` 让 `routeTree.gen.ts` 重新生成。
- **`env[].valueFrom`**：只有引用没有值，直接读 `value` 会显示空白，需要展示引用来源。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01.yaml`
可观测点：`container-detail:surface`、`:basic`、`:resources`、`:env`、`:mounts`、`:ports`、`:probes`。

## 后续改进

- 容器日志/终端（依赖 BFF 的流式代理）。
- 单容器监控（依赖监控区间查询）。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01