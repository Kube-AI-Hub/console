# 容器详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/container-detail.md)

## 概述

从容器组对象派生单个容器的视图并分区展示，只读；日志（搜索 + 实时 tail）与终端（exec WebSocket）是本页的两条流式通道。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03
- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01

## 设计目标与非目标

目标：一屏回答「这个容器配置成什么样」，并能直接看它的日志——搜索历史（最近 1 小时）与实时 tail 两种读法；还能直接在容器里执行命令。
非目标：容器编辑（改模板才是唯一入口）；单容器监控仍登记为待补，见 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02`。日志 tail 不依赖 WebSocket（见 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03`），终端依赖它，见 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-04`。

## 关键约束

- 数据源只有容器组对象：`spec.containers[]`、`spec.volumes[]`、`status.containerStatuses[]`。
- 日志搜索读租户日志接口；实时 tail 读 kube 的 `log` 子资源，走 BFF 已有的 HTTP 流式代理，不新建 WebSocket。
- 路由：`…/pods/$name/containers/$container`，挂在容器组详情之下。
- 终端走 kube 原生 exec WebSocket（`v5.channel.k8s.io`）：BFF 只透传升级请求，入口（开发期是 `scripts/dev-static-server.mjs`）必须同样转发 `Upgrade`，否则浏览器连不到 BFF。
- 终端使用 xterm.js + FitAddon，保留 ANSI、光标寻址和备用屏幕；键盘直接送入 PTY，不使用命令表单。

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

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-04 — 终端走 kube 原生 exec WebSocket，BFF 做 upgrade 转发

**为什么**：容器终端必须是一条全双工通道，HTTP 的请求/响应模型表达不了，日志那条 chunked HTTP 的做法不适用于 stdin。B200 实测（k8s v1.37.0 / ks-apiserver v3.4.1，2026-11-14）：`GET /api/v1/namespaces/<ns>/pods/<pod>/exec?container=…&stdin=true&stdout=true&stderr=true&tty=true&command=/bin/sh` 带 `Upgrade: websocket` 与 `Sec-WebSocket-Protocol: v5.channel.k8s.io` 返回 101，帧格式是「1 字节通道号 + 载荷」：0 stdin / 1 stdout / 2 stderr / 3 error（kube `Status` JSON）/ 4 resize（`{Width,Height}`）。k8s 1.37 已移除 SPDY，WebSocket 是唯一可行传输。BFF 用 `server.on('upgrade')` 把原始 socket 透传给上游，HTTP 代理路径一行不改。

**被否方案**：老 console 的 `kapis/terminal.kubesphere.io/v1alpha2/…/exec`（子协议 `binary.k8s.io`，消息是 `{Op:'stdin'}` 这类 KubeSphere 自定义封装）。它要求上游是 KubeSphere 的 terminal 服务，且多一层与 kube 原生协议无关的编解码；`/api/v1` 的 exec 端点在同一台 ks-apiserver 上，原生协议少一层、可直接用标准帧验证。

**被否方案**：改成 SSE/长轮询自造双向协议。stdin 是持续写入，没有双向通道就要自己定义帧与背压，比透传一次 upgrade 复杂，也失去原生协议的可诊断性。

**被否方案（鉴权）**：token 放 query。会进访问日志与代理 trace；浏览器 WebSocket 唯一能自定义的握手字段是子协议，因此用 `bearer.<token>`，BFF 剥离后转成上游的 `Authorization` 头（核心设计里「token 从 query 或子协议取」的两种取法之一）。非浏览器客户端仍可直接用 `Authorization` 头。

**代价**：入口处的每一层都必须转发 `Upgrade`（仓库里是 `scripts/dev-static-server.mjs`，生产入口同理，否则浏览器根本连不到 BFF）；BFF 只放行 `/api/v1|/apis/…/exec` 一条升级路径，不做通用 socket 代理；浏览器读不到失败握手的 HTTP 状态，页面只能给通用错误，具体原因留在 BFF/上游响应体里。

**何时重新考虑**：出现节点 shell、kubectl 会话等第二个 exec 入口时，把 `server/src/upgrade.ts` 的路径规则扩展成一份表，而不是复制一份转发。

## 系统现状

老 console：`/pods/:podName/containers/:containerName`，四个页签（资源状态/监控/环境变量/日志）。本页迁出「资源状态 + 环境变量」并补齐挂载、端口、探针；日志已补齐两段（搜索 + 实时 tail）；终端已补齐（exec WebSocket）；监控按 `DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02` 仍登记为待补。

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

### 终端（exec）

终端是本控制台的第一条**双向**流式通道，链路比日志多两次协议切换：

```
ContainerTerminal（页面区块）
  └─ openExecSession()                api-client：原生 WebSocket + 通道帧编解码
       └─ ws://<console>/api/v1/…/pods/<pod>/exec?container=…&tty=true&command=/bin/sh
            └─ 入口（dev-static-server）  server.on('upgrade') 原样转发 Upgrade 握手
                 └─ BFF                     server.on('upgrade') → 上游 101，socket 双向 pipe
                      └─ ks-apiserver       Authorization: Bearer <token>（由 bearer.<token> 子协议转换）
                           └─ kube-apiserver → kubelet → 容器内 /bin/sh
```

**鉴权**：浏览器 `WebSocket` 构造器不能设置请求头，而本控制台的身份就是 bearer token（没有 cookie 会话）。客户端把 token 放进子协议 `bearer.<jwt>` 作为握手的一部分；BFF 在转发前剥离该子协议并设置 `Authorization` 头，上游只看到 kube 认识的 `v5.channel.k8s.io`。脚本/测试可直接用 `Authorization` 头，BFF 同样接受。

**BFF 的边界**（`server/src/upgrade.ts`）：
- 只转发 `/api/v1/…/exec` 与 `/apis/…/exec`，其他路径的 upgrade 一律 404；不把它做成通用 socket 代理。
- 无 token → 401；上游连不上或 15s 内不完成握手 → 502（错误体仍是 `BffError` 形状）；上游拒绝升级（RBAC 403、pod 不存在）→ 原样回传上游状态与响应体。
- 101 之后双向 `pipe`，任一方向断开即销毁另一侧；客户端断开时上游 exec 会话随之结束。

**客户端契约**（`@kube-ai-hub/api-client` 的 `exec.ts`）：

```ts
openExecSession({ cluster, namespace, pod, container, command, getToken, onData, onOpen, onError, onClose })
  → ExecSession（write(data) / resize(cols, rows) / close()）
```

- 帧格式即上表的通道号；`write` 发 0 通道，`resize` 发 4 通道。
- 收到通道 3 的 `Status`：`Success` 视为 shell 正常退出；其余解析出 message 作为 `ApiError`（折叠 kubelet 重复的 `Internal error occurred:` 前缀）。
- 握手在打开前失败时浏览器只知道「失败」，客户端报 `connection_failed`；已连接后异常断开报 `network_error`。
- 输出保留原始转义序列，由 xterm 渲染；UTF-8 解码跨帧保留状态，终端维护 5000 行滚动历史及备用屏幕。

**页面状态机**：`connecting → connected → closed | error`。进入 `connected` 前输入框禁用；`error` 显示通用提示 + 上游原因，并提供「重新连接」；关闭面板或卸载页面必须 `close()`，BFF 随客户端断开销毁上游 exec。

## 仓库落点

- 页面：`apps/console-next/src/pages/app-workloads/ContainerDetailPage.tsx`
- 流式读取：`packages/api-client/src/logs.ts`（`openPodLogStream` / `streamPodLogs`），底层是 `client.stream()`（`packages/api-client/src/client.ts`）
- BFF：`kube-frontend/server/src/proxy.ts` 已是流式转发，唯一改动是「读者放弃时销毁上游请求」，否则每次关闭实时都会在 ks-apiserver 上留一条永不结束的 follow
- 终端：`packages/api-client/src/exec.ts`（原始流与 UTF-8 解码）、`ContainerTerminal.tsx`（入口）、共享 `components/resource/ExecConsoleDialog.tsx`（会话）、ai-kit 的 `terminal/TerminalView.tsx`（模拟器）及 BFF upgrade 透传。
- 开发入口：`kube-frontend/scripts/dev-static-server.mjs` 增加 `on('upgrade')` 原样转发，否则浏览器到 BFF 的 WebSocket 在入口就被丢弃
- 路由：`routes/…/pods/$name/containers/$container.tsx`（容器组详情由 `$name.tsx` 改造为 `$name/` 目录，index 即原详情）
- 容器组详情的容器区块：`WorkloadDetailPage.tsx`（仅 pods 提供容器链接）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 容器组 | /kapis/resources.kubesphere.io/v1alpha3/namespaces/&lt;ns&gt;/pods/&lt;name&gt;（含 spec/status） |
| 历史日志（搜索） | /kapis/tenant.kubesphere.io/v1alpha2/logs（最近 1 小时，最多 200 行） |
| 实时日志 tail | /api/v1/namespaces/&lt;ns&gt;/pods/&lt;pod&gt;/log?container=&lt;c&gt;&amp;follow=true&amp;timestamps=true（HTTP chunked，无 content-length） |
| 容器终端 | ws(s)://&lt;console&gt;/api/v1/namespaces/&lt;ns&gt;/pods/&lt;pod&gt;/exec?container=&lt;c&gt;&amp;stdin=true&amp;stdout=true&amp;stderr=true&amp;tty=true&amp;command=/bin/sh（子协议 v5.channel.k8s.io；BFF 要求 bearer.&lt;token&gt; 或 Authorization 头，上游只收 Authorization） |

## 不变量

1. 容器视图全部字段来自容器组对象，不额外请求。
2. 五个区块能把「空」与「有内容」区分开。
3. 容器名不在对象里时显示明确提示，而不是空白页。
4. 实时开关是日志区块唯一的模式入口：同一时刻只显示搜索或流中的一个，关闭开关必须 abort 连接。
5. 实时列表最多 1000 行，且始终保留最新的行（旧行从头丢弃）。
6. 日志在独立近全屏弹窗显示，实时开关默认关闭；历史与实时只显示一个来源，关闭弹窗取消流。
7. 终端只有一个连接：关闭面板、重新连接、离开路由都必须先关掉上一条 WebSocket。
8. 终端滚动历史最多 5000 行，日志历史最多 1000 行；备用屏幕不追加为日志历史。
9. 没有 token 时不发起 WebSocket：客户端在本地就报未登录，而不是让浏览器报一个无法诊断的握手失败。
10. BFF 不得把非 `exec` 路径的 upgrade 转发到集群。

## 已知坑

- **`$name.tsx` 与 `$name/` 不能共存**：容器详情要挂在容器组详情之下，必须把 `$name.tsx` 改成 `$name/{route,index}.tsx`，否则路由树冲突；改完要重新 `vite build` 让 `routeTree.gen.ts` 重新生成。
- **`env[].valueFrom`**：只有引用没有值，直接读 `value` 会显示空白，需要展示引用来源。
- **上游 flush 阈值（务必先读这条）**：B200 上（ks-apiserver v3.4.1 / k8s v1.37.0，2026-11-14 实测）log 流要等缓冲数据达到约 4 KB 才吐出响应头。`follow=true` + 小 `tailLines` 会在没有后续输出时**永远收不到响应头**：同一个 pod，`tailLines=20`（3771 字节）挂死 20 秒 0 字节，`tailLines=25`（4735 字节）30 ms 就 200 并持续输出。因此 follow 路径**不发 `tailLines`**，只发 `follow=true&timestamps=true`，由 UI 截断到 1000 行。下游接手的第一个人一定会想当然把 `tailLines` 加回去，加了就回到「实时日志一直连接中」。
- **安静容器也受影响**：日志不足 4 KB 且暂无新输出的容器（如 juicefs 的 liveness-probe）纯 `follow=true` 同样收不到响应头。页面此时停在「正在连接日志流…」——这是上游行为，前端无法区分「连接中」与「上游不发头」，不要用超时把它误报成失败。
- **`Accept: text/plain` 会被上游回 406**：kube 的 log 子资源只接受 `*/*`。`api-client` 的 `stream()` 用 `Accept: */*`，不要照抄 JSON 路径的 `application/json`。
- **关闭必须 abort**：页面切回搜索、离开路由、组件卸载都要 `close()`；BFF 侧再由 `response.on('close')` 销毁上游请求，否则每次开关都在 ks-apiserver 上留一条不会结束的 follow 流。
- **入口不转发 Upgrade，终端一定连不上**：浏览器很可能把升级请求当普通 HTTP 处理，页面表现为一直「正在连接终端…」或通用错误。本仓库的入口是 `scripts/dev-static-server.mjs`，已加 `on('upgrade')`；改静态服务后必须重启它才生效（进程加载的是旧脚本）。
- **浏览器读不到失败握手的 HTTP 状态**：`WebSocket` 的 error/close 事件不携带 101 之外的响应。BFF 的 401/404/502 只能作为通用错误展示；要把具体原因带出来，用非浏览器客户端（测试里用 `Authorization` 头）看 BFF 的响应体。
- **token 不能放 query**：会进访问日志与代理 trace；用 `bearer.<token>` 子协议。JWT 的字符集（base64url + 点）在子协议 token 的合法范围内。
- **没有 `/bin/sh` 的容器不是「连接失败」**：握手会成功，kubelet 用通道 3 返回 `Status`（`stat /bin/sh: no such file or directory`）。页面必须把这条展示出来，而不是停在「已连接」的空白输出区。
- **pty 会回显输入**：输出区里出现两遍命令属正常（一遍来自回显、一遍来自命令本身）。自动化断言要认「单独成行」的输出，不能只做子串匹配。
- **k8s 1.37 没有 SPDY**：exec 只能走 WebSocket（`v5.channel.k8s.io`）；不要照老 console 的 `binary.k8s.io` + `{Op:…}` 封装去接 `/api/v1`。

## 测试与可观测

用例：
- `tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01.yaml`（配置与状态）
- `tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02.yaml`（日志搜索）
- `tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03.yaml`（实时 tail：开 → 有行 → 停）

- `tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01.yaml`（终端：开 → echo → 输出 → 关；无 shell 的错误态）

可观测点：`container-detail:surface`、`:basic`、`:resources`、`:env`、`:mounts`、`:ports`、`:probes`、`:logs`、`:log-list`、`:log-keyword`；
实时：`:log-follow`（开关，`aria-checked` 表示状态）、`:log-stream`（流容器，`data-ai-state` 为 loading/ready/error）、`:log-stream-list`（行列表，每行一个 `data-ai-row`）、`:log-stream-stop`、`:log-stream-retry`；
终端：`:terminal-open`、`:terminal`（弹窗内部状态）、`:terminal-output`（xterm 渲染器）、`:terminal-close`、`:terminal-retry`、`:terminal-error`；键盘输入使用 xterm-helper-textarea，不再使用旧命令框与执行按钮。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-05 — 日志与终端使用近全屏独立控制台

**为什么**：命令表单无法承接 vim 的光标寻址、Esc、备用屏幕及格式输出。
ai-kit TerminalView 只负责 VT 渲染、键盘与 ResizeObserver；应用层负责鉴权与连接。
Modal 的 console 尺寸距视口边缘 8px，终端禁用 Escape/遮罩退出，将 Esc 留给程序。

**被否方案**：继续剥离 ANSI，或把 xterm 绑定页面小区域；均无法提供用户要求的控制台交互。
将日志改为 WebSocket 没有必要，现有 HTTP 流式协议继续使用。

**何时重新考虑**：需要多会话管理或独立窗口时增加会话容器，不改变模拟器与传输分层。

**实现约束**：xterm 按需加载，不进入普通列表的初始包；PTY 设置 TERM=xterm-256color，
输入直接发送，resize 使用通道 4，UTF-8 解码跨帧保留状态；日志按浏览器帧批量写入。
Tab 保留 `\t` 原样送入 stdin，交互式 shell 优先 bash、缺失回退 sh；补全候选和历史由远端生成。
关闭、重连、切换日志模式和卸载均清理连接；不记录命令或持久化输出。

## 后续改进

- 单容器监控（依赖监控区间查询）。
- xterm + FitAddon 已落地近全屏弹窗，支持光标、颜色与备用屏幕；远端必须安装 vim/vi 等程序，本功能不在生产容器内安装软件。
- 节点 shell 与 kubectl 会话：复用 `server/src/upgrade.ts`，把路径规则扩成一份表。
- 上游修好 flush 后，follow 请求可以加回 `tailLines`，避免回放整个日志文件。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01
- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02
- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03
- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01
