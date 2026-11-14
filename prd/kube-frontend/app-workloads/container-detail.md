# 容器详情（L3）

[子模块需求](./_index.md)

## 概述

容器组里单个容器的详情：镜像与拉取策略、状态与重启次数、命令与参数、资源请求/限制、环境变量、挂载卷、端口与探针。

日志已落地两段：最近 1 小时的搜索（租户日志接口）与**实时 tail**（kube 的 `log` 子资源，HTTP chunked，不需要 WebSocket）。容器终端走 BFF 新增的 WebSocket upgrade 转发，协议为 kube 原生的 `v5.channel.k8s.io`（k8s 1.37 已移除 SPDY）；单容器监控仍依赖监控区间查询，尚未落地。

## 用户故事

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

### US2 - 在容器里执行命令 (Priority: P1)

作为 **项目成员**，我希望 **直接在容器里执行命令并看到输出**，以便 **排查配置与状态都解释不了的运行期问题（进程、文件、网络）**。

**Independent Test**：打开一个容器内有 `/bin/sh` 的容器详情，点「打开终端」，输入 `echo tc-terminal-ok` 并回车，输出区出现 `tc-terminal-ok`，关闭后连接释放。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01** — 已知容器组有容器，当从容器组详情点容器名进入容器详情，则显示名称、镜像、镜像拉取策略、状态、重启次数、启动时间、命令与参数，以及资源（请求/限制）、环境变量、挂载卷、端口与探针五个区块；镜像与拉取策略等于该容器组对象中该容器的字段；区块无内容时显示说明而非空表；容器组不存在该容器时显示「这个容器不存在」。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02** - 点「打开日志控制台」在近全屏独立弹窗显示最近 1 小时的容器日志（时间 + 内容，最多 200 行）；提交关键字通过 log_query 收窄结果；无日志显示空态，保留 ANSI 格式。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03** — 日志弹窗的「实时」开关切换到流式日志；保留最近 1000 行滚动历史，连接与断开状态可见，刷新可重连。关闭开关恢复搜索模式，关闭弹窗立即取消日志流。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01** — 点「打开终端」在近全屏独立弹窗连接远端 PTY；直接键入命令与回车可看到真实输出，保留 ANSI、光标寻址与备用屏幕，支持目标容器中已安装的 vim/vi。方向键、Esc、Ctrl+C 发送给远端，Esc 不关窗；窗口尺寸变化同步 PTY 行列。关闭弹窗释放连接，无 shell 或连接失败明确报错并可重连。

## 设计目标

1. 一屏回答「这个容器配置成什么样」。
2. 与容器组详情同一套字段命名与徽标。
3. 终端能连上、能输入、能看见输出；连不上时给出原因而不是空白或一直转圈。

## 约束与边界

- 数据来自容器组对象本身（`spec.containers[]` 与 `status.containerStatuses[]`），不额外请求。
- 日志搜索走租户日志接口；实时 tail 走 kube 的 `log` 子资源（HTTP chunked），不依赖 WebSocket；两者不同时展示，实时开关是唯一入口。
- 容器终端走 WebSocket（`GET /api/v1/namespaces/<ns>/pods/<pod>/exec`，子协议 `v5.channel.k8s.io`），必须经 BFF 的 upgrade 转发；浏览器原生 WebSocket 不能带 `Authorization` 头，token 经 `bearer.<token>` 子协议传给 BFF，由 BFF 转成上游的 `Authorization` 头。
- 终端使用 xterm.js 模拟器，原始 PTY 输出不裁剪转义序列；远端 shell 设置 TERM=xterm-256color，
  优先启动交互式 bash，缺失时回退交互式 sh。Tab、历史及行编辑由目标 shell 提供，前端不拦截补全按键。
- 只读：终端里的命令由容器自身执行，控制台不代理、不记录、不持久化其输出。

## UI 交互设计

- 顶部返回容器组详情的链接。
- 基本信息两列；资源、环境变量、挂载卷、端口、探针各一块。
- 日志入口打开近全屏弹窗，默认历史搜索；弹窗内切换实时模式，支持鼠标选择复制与滚动阅读，保留格式。
- 终端入口打开近全屏弹窗，键盘直接操作终端，不再显示命令输入框和执行按钮；错误与断开可重连，右上角关闭会话。

## 文案与校验

- 空态：没有环境变量 / 没有挂载卷 / 没有声明端口 / 没有探针。
- 缺失容器：这个容器不存在（可能已被重建）。
- 实时日志：开关「实时」；连接中「正在连接日志流…」；已连接等待新行「已连接，等待新日志…」；断开「日志流已断开。」；按钮「停止实时」「重新连接」；提示「打开后从日志搜索结果切换到实时流，最多保留 1000 行。」
- 终端：入口「打开终端」；连接中「正在连接终端…」；已连接提示直接键入；错误显示上游原因，操作为关闭或重连，支持方向键、Esc 与 Ctrl+C。

## 边界情况

- `status.containerStatuses` 缺失（容器还没启动）：状态显示 `-`、重启次数 0。
- `env[].valueFrom`：显示引用的来源而不是空值。
- 实时日志超过 1000 行：只保留最后 1000 行，旧行滚出。
- 实时流断开（容器重启、日志轮转、网络中断）：显示「日志流已断开。」并提供「重新连接」，不静默停止。
- 容器当前没有日志输出：上游在日志量很小时不会及时返回响应头（见技术方案「已知坑」），页面停留在「正在连接日志流…」，不假装成功、不报错。
- 容器内没有 `/bin/sh`：exec 在升级成功后才失败，上游用错误通道返回原因；面板进入错误态并显示该原因（如 `stat /bin/sh: no such file or directory`），不是空白。
- 终端失败握手（BFF 401/404/502）在浏览器里读不到 HTTP 状态：页面显示通用错误与「重新连接」，具体原因看 BFF 的响应体。
- 终端滚动历史上限 5000 行；备用屏幕由终端模拟器维护，不把全屏程序逐帧追加为日志。
- 关闭面板或离开页面：关闭 WebSocket，BFF 随之销毁到上游的连接，不留后台会话。

## 明确不做

- 容器实时日志已实现（本页日志区块的「实时」开关），不属于「不做」。
- 容器终端已实现（本页「终端」区块），不属于「不做」。
- 单容器监控：依赖监控区间查询，尚未落地，不放页签。
- 节点 shell 与 kubectl 目标解析不在本页范围；完整终端模拟器已用于本页及 kubectl 的共享弹窗。
- 容器编辑：容器由所属工作负载的模板定义，改模板才是唯一入口。

## 假设

- 容器组对象的 `spec.containers` 与 `status.containerStatuses` 按名称一一对应。
- 容器镜像里有 `/bin/sh`；其他 shell 不作为默认，没有 `/bin/sh` 时按错误态处理。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01** — 从容器组对象派生容器视图并分区展示。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02** — 容器不存在时给出明确提示。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03** — 「实时」开关把日志区块切换到 kube `log` 子资源的流式读取，按行追加、最多 1000 行，可停止与重连。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01** — 近全屏交互终端通过 BFF WebSocket exec 收发，支持格式、光标和全屏程序，滚动历史上限 5000 行，关闭与重连清理连接。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01** — 镜像/拉取策略与对象一致；五个区块各自能区分「空」与「有内容」。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02** — 实时开关打开后流列表出现且行数 ≥ 1；停止后不再追加；断开有提示并可重连；开关关闭时搜索区块的对外标识与行为不变。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01** — 带 shell 的容器能进入「已连接」并看到命令输出；无 shell 的容器进入错误态并显示上游原因；关闭后面板移除且连接释放。
