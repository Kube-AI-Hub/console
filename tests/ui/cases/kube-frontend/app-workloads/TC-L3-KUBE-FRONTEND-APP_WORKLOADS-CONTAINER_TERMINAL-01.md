# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01 容器终端 · exec WebSocket 通道

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-terminal`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/kubesphere-system/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

容器详情页在近全屏独立弹窗打开真实交互终端，保留格式与光标，关闭后释放 exec 连接。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01** — 点「打开终端」在近全屏独立弹窗连接远端 PTY；直接键入命令与回车可看到真实输出，保留 ANSI、光标寻址与备用屏幕，支持目标容器中已安装的 vim/vi。方向键、Esc、Ctrl+C 发送给远端，Esc 不关窗；窗口尺寸变化同步 PTY 行列。关闭弹窗释放连接，无 shell 或连接失败明确报错并可重连。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

### US2 - 在容器里执行命令 (Priority: P1)

作为 **项目成员**，我希望 **直接在容器里执行命令并看到输出**，以便 **排查配置与状态都解释不了的运行期问题（进程、文件、网络）**。

**Independent Test**：打开一个容器内有 `/bin/sh` 的容器详情，点「打开终端」，输入 `echo tc-terminal-ok` 并回车，输出区出现 `tc-terminal-ok`，关闭后连接释放。

## 前置与配置

- 已登录
- kubesphere-system 下存在「容器里有 /bin/sh、exec 可以启动」的容器组（用例先按容器镜像优先级探测，探不到可执行 shell 的容器时跳过并说明原因）

## 测试步骤

1. 用 API 列出 kubesphere-system 的运行中容器组，按 ks-console / ks-apiserver / tower 优先排序，取每个容器组的容器
2. 依次打开候选容器的详情页并点「打开终端」
3. 等终端面板进入「已连接」（data-ai-state=ready）；若错误文本是上游的 no such file / stat /bin/sh，说明该容器没有 shell，记录下来换下一个候选；若是连接被拒绝则判定通道故障，直接失败
4. 在模拟器的键盘输入目标直接键入 echo tc-terminal-ok 并回车
5. 等输出区出现一行内容恰为 tc-terminal-ok
6. 点「关闭终端」，确认终端面板从页面移除、入口按钮重新出现
7. 若探测阶段发现过没有 shell 的容器，再打开它并断言终端面板进入 error 且错误区有非空的上游原因

## 期望结果

- 终端面板从 loading 进入 ready，输入的命令有输出，输出区里存在一行恰好是 tc-terminal-ok（不是输入回显的那一行）
- 关闭后终端面板消失、入口按钮可见；连接被页面释放
- 没有 /bin/sh 的容器：终端面板进入 error，错误区显示上游原因（含 no such file），不是空白也不是一直 loading
- 探不到带 shell 的容器时 skip，并说明原因

## 失败排查

- 一直 loading：BFF 的 upgrade 未生效（8092 是否重启过），或前面一层的静态服务器没有转发 Upgrade（dev-static-server 需要 on('upgrade')）；看 /api/v1/.../exec 的 101 握手
- 面板进入 error 且错误文本含 connection refused：浏览器到 BFF 的 WebSocket 被拒绝（鉴权子协议 bearer.<token> 是否带上、BFF 是否 401）
- 输出区没有 tc-terminal-ok：确认容器有 /bin/sh；没有 shell 的容器会走 error 分支而不是输出

## 产品改版后如何更新自动化

- 选择器见 ExecConsoleDialog.tsx，键盘输入目标为 xterm-helper-textarea，输出读取 xterm-rows
