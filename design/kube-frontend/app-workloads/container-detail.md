# 容器详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/container-detail.md)

## 概述

从容器组对象派生单个容器的视图并分区展示，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03

## 设计目标与非目标

目标：一屏回答「这个容器配置成什么样」，并能直接看它的日志——搜索历史（最近 1 小时）与实时 tail 两种读法。
非目标：容器编辑（改模板才是唯一入口）；容器终端与单容器监控仍登记为待补，见 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02`，日志 tail 不算在内，它不依赖 WebSocket（见 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03`）。

## 关键约束

- 数据源只有容器组对象：`spec.containers[]`、`spec.volumes[]`、`status.containerStatuses[]`。
- 日志搜索读租户日志接口；实时 tail 读 kube 的 `log` 子资源，走 BFF 已有的 HTTP 流式代理，不新建 WebSocket。
- 路由：`…/pods/$name/containers/$container`，挂在容器组详情之下。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01 — 视图在页面内派生，不进 api-client

**为什么**：容器不是一个可寻址的资源，没有自己的接口；它是容器组对象的一段。为它造 `containerApi` 会暗示「可以单独获取/修改容器」，与事实不符。派生函数与页面同文件，类型也只在本页使用。
**被否方案**：在 api-client 里加 `toContainerView`。收益是跨页复用，但这个视图只有一个使用者。
**何时重新考虑**：出现第二个需要「同一份容器视图」的页面时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02 — 日志/终端/监控页签待 WebSocket 通道就绪后补齐

**为什么**：三个页签分别依赖流式日志、WebSocket exec、监控区间查询。通道建立之后它们是容器详情的主体内容——尤其是日志与终端，占了排障动作的大半。

**被否方案（原决策，2026-11-14 推翻）**：不做这三个页签，理由是「BFF 只代理普通 HTTP，没有这些端点；做出来只能是点了报错或永远转圈」。**问题在于把「依赖还没建」当成了「永久不做」**，而且当时的「何时重新考虑」写的就是「BFF 增加 exec/流式代理时」——那个条件现在成立了。原决策里仍然成立的一半是「不保留会报错的页签」，保留：通道就绪前不放页签。

**落地顺序**：先做容器日志（只需日志接口 + 流式 tail），再做终端（需 exec），最后做单容器监控（需监控区间查询）。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03 — 实时日志走 HTTP chunked，先于 exec 落地

**为什么**：kube 的 `GET /api/v1/namespaces/<ns>/pods/<pod>/log?follow=true` 是一个永不结束的 HTTP 响应，kube-apiserver 按行追加、chunked 传输。BFF 的代理本来就是 `upstreamResponse.pipe(response)`（`kube-frontend/server/src/proxy.ts`），Authorization 也是逐跳透传的，所以这条通道**今天就能用，零新增服务端端点**。exec 不同：它要求 `Upgrade: websocket` 的协议升级，BFF 的 `http.request` 代理不支持 upgrade，必须单独实现，工作量与风险都高一个量级。

**被否方案**：用 `EventSource`。它不能设置 `Authorization` 头，而本控制台的身份就是 bearer token（BFF 没有 cookie 会话），所以只能 `fetch` + `response.body` 的 reader。kube 的日志接口也不是 SSE 格式，硬套还要自己拆事件流。

**被否方案**：等 WebSocket 通道一起做。日志是排障最高频的动作，为一个不需要 WebSocket 的功能等整条通道，是把「能力缺」拖成「永久缺」。

**代价**：客户端要自己管生命周期（reader、abort、行缓冲），以及一个上游限制（见「已知坑」的 4 KB flush 问题）。这些都在 `openPodLogStream` 里收口，页面只消费行。

**何时重新考虑**：上游修好 flush 后可把 `tailLines` 加回 follow 请求；exec 落地后终端与日志共享同一套流生命周期封装。

## 系统现状

老 console：`/pods/:podName/containers/:containerName`，四个页签（资源状态/监控/环境变量/日志）。本页迁出「资源状态 + 环境变量」并补齐挂载、端口、探针；日志已补齐两段（搜索 + 实时 tail）；监控与终端按 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02` 登记为待补。

## 流式通道

实时日志是本控制台的第一条流式通道，链路是：

```
ContainerDetailPage
  └─ openPodLogStream()            api-client：fetch + response.body reader，按行切分
       └─ GET /api/v1/…/pods/<pod>/log?follow=true&timestamps=true
            └─ BFF proxy            upstreamResponse.pipe(response)：逐块转发，不缓冲
                 └─ ks-apiserver    /api/v1 通用代理（bearer 透传，逐跳身份）
                      └─ kube-apiserver → kubelet
```

**服务端没有新增端点**。BFF 的 `proxyRequest` 本来就是流式转发：它把请求头（含 `Authorization`）转给上游、把响应头（去掉 `content-encoding`/`transfer-encoding`/`connection` 这些逐跳头）写回，然后 `pipe` 响应体。日志接口只是「一个很长的 HTTP 响应」，因此直接复用。唯一补的一行是「读者关闭连接时销毁上游请求」：follow 流不会自己结束，abort 不销毁上游就会泄漏。

**客户端契约**（`@kube-ai-hub/api-client` 的 `logs.ts`）：

```ts
openPodLogStream(client, { cluster, namespace, pod, container, follow, timestamps, signal })
  → PodLogStream（AsyncIterable<string> + close()）
streamPodLogs(client, { … })   // 同样的读法，无可关闭句柄时用 signal 中止
```

- 用 `fetch` 而不是 `EventSource`：后者无法携带 `Authorization`，而身份就是 bearer token。
- 非 2xx 在 api-client 里转成 `ApiError`，页面拿到的是「错误」，不是被当成日志的 HTML 错误页。
- 行切分在客户端做（`TextDecoder` + 换行缓冲），空行丢弃；断流/abort 都结束迭代。

**页面状态机**：`idle → connecting → streaming → error`。`connecting` 显示「正在连接日志流…」；`streaming` 追加行并滚到底部；正常结束或异常进入 `error`，显示「日志流已断开。」+「重新连接」。关闭开关或「停止实时」调 `close()`，同时把缓冲清空。

**为什么 follow 不带 `tailLines`**：见「已知坑」第一条。结论是 follow 请求只发 `follow=true&timestamps=true`，把整段当前日志回放出来，再由 UI 只保留最后 1000 行。这是对上游 flush 缺陷的绕过，不是设计偏好。

## 仓库落点

- 页面：`apps/console-next/src/pages/app-workloads/ContainerDetailPage.tsx`
- 流式读取：`packages/api-client/src/logs.ts`（`openPodLogStream` / `streamPodLogs`），底层是 `client.stream()`（`packages/api-client/src/client.ts`）
- BFF：`kube-frontend/server/src/proxy.ts` 已是流式转发，唯一改动是「读者放弃时销毁上游请求」，否则每次关闭实时都会在 ks-apiserver 上留一条永不结束的 follow
- 路由：`routes/…/pods/$name/containers/$container.tsx`（容器组详情由 `$name.tsx` 改造为 `$name/` 目录，index 即原详情）
- 容器组详情的容器区块：`WorkloadDetailPage.tsx`（仅 pods 提供容器链接）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 容器组 | /kapis/resources.kubesphere.io/v1alpha3/namespaces/&lt;ns&gt;/pods/&lt;name&gt;（含 spec/status） |
| 历史日志（搜索） | /kapis/tenant.kubesphere.io/v1alpha2/logs（最近 1 小时，最多 200 行） |
| 实时日志 tail | /api/v1/namespaces/&lt;ns&gt;/pods/&lt;pod&gt;/log?container=&lt;c&gt;&amp;follow=true&amp;timestamps=true（HTTP chunked，无 content-length） |

## 不变量

1. 容器视图全部字段来自容器组对象，不额外请求。
2. 五个区块能把「空」与「有内容」区分开。
3. 容器名不在对象里时显示明确提示，而不是空白页。
4. 实时开关是日志区块唯一的模式入口：同一时刻只显示搜索或流中的一个，关闭开关必须 abort 连接。
5. 实时列表最多 1000 行，且始终保留最新的行（旧行从头丢弃）。
6. 实时开关默认关闭；关闭时原有日志搜索的 `data-ai-id`（`container-detail:logs` / `:log-list` / `:log-keyword`）与行为不变。

## 已知坑

- **`$name.tsx` 与 `$name/` 不能共存**：容器详情要挂在容器组详情之下，必须把 `$name.tsx` 改成 `$name/{route,index}.tsx`，否则路由树冲突；改完要重新 `vite build` 让 `routeTree.gen.ts` 重新生成。
- **`env[].valueFrom`**：只有引用没有值，直接读 `value` 会显示空白，需要展示引用来源。
- **上游 flush 阈值（务必先读这条）**：B200 上（ks-apiserver v3.4.1 / k8s v1.37.0，2026-11-14 实测）log 流要等缓冲数据达到约 4 KB 才吐出响应头。`follow=true` + 小 `tailLines` 会在没有后续输出时**永远收不到响应头**：同一个 pod，`tailLines=20`（3771 字节）挂死 20 秒 0 字节，`tailLines=25`（4735 字节）30 ms 就 200 并持续输出。因此 follow 路径**不发 `tailLines`**，只发 `follow=true&timestamps=true`，由 UI 截断到 1000 行。下游接手的第一个人一定会想当然把 `tailLines` 加回去，加了就回到「实时日志一直连接中」。
- **安静容器也受影响**：日志不足 4 KB 且暂无新输出的容器（如 juicefs 的 liveness-probe）纯 `follow=true` 同样收不到响应头。页面此时停在「正在连接日志流…」——这是上游行为，前端无法区分「连接中」与「上游不发头」，不要用超时把它误报成失败。
- **`Accept: text/plain` 会被上游回 406**：kube 的 log 子资源只接受 `*/*`。`api-client` 的 `stream()` 用 `Accept: */*`，不要照抄 JSON 路径的 `application/json`。
- **关闭必须 abort**：页面切回搜索、离开路由、组件卸载都要 `close()`；BFF 侧再由 `response.on('close')` 销毁上游请求，否则每次开关都在 ks-apiserver 上留一条不会结束的 follow 流。

## 测试与可观测

用例：
- `tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01.yaml`（配置与状态）
- `tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02.yaml`（日志搜索）
- `tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03.yaml`（实时 tail：开 → 有行 → 停）

可观测点：`container-detail:surface`、`:basic`、`:resources`、`:env`、`:mounts`、`:ports`、`:probes`、`:logs`、`:log-list`、`:log-keyword`；
实时：`:log-follow`（开关，`aria-checked` 表示状态）、`:log-stream`（流容器，`data-ai-state` 为 loading/ready/error）、`:log-stream-list`（行列表，每行一个 `data-ai-row`）、`:log-stream-stop`、`:log-stream-retry`。

## 后续改进

- 容器终端（依赖 WebSocket exec；与日志共享同一套流生命周期封装）。
- 单容器监控（依赖监控区间查询）。
- 上游修好 flush 后，follow 请求可以加回 `tailLines`，避免回放整个日志文件。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01
- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02
- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03