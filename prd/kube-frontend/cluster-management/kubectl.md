# kubectl 终端（L3）

[子模块需求](./_index.md)

## 概述

管理员在选定集群连接自己已有的 kubectl 工具容器，输入命令并读取文本输出。

## 用户故事

### US1 - 在浏览器执行集群命令 (Priority: P1)

作为 **集群管理员**，我希望 **连接自己的工具容器执行 kubectl**，以便 **无需下载配置即可进行运维**。

**Independent Test**：点击连接，执行唯一标记的只读命令并读取结果；关闭后输入禁用且会话销毁。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01** — 集群侧栏可进入kubectl，直接访问工具页需主动连接；概览kubectl按钮一次点击原地打开近全屏弹窗，查询当前账号/集群工具目标后直接连接PTY，不需二次点击。关闭/离开/切身份释放连接并取消准备，晚到响应不重开，返回工具页不自动连接；未就绪不创建替代Pod，403无重试，错误明确可见。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02** — 交互终端保留 ANSI 色彩、光标与备用屏幕。目标有 vim/vi 时可进入编辑器，用方向键移动光标并插入字符；Esc 不关闭弹窗，退出编辑器恢复 shell；窗口尺寸同步远端行列，滚动历史上限 5000 行。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03** — Tab 原样发送给远端，不移走终端焦点；支持目标 shell 的命令和路径补全、上下键历史及 Ctrl+A/E/U 行内编辑。默认优先交互式 bash，未安装时回退交互式 sh；高级补全依赖目标 shell 和已配置的补全脚本。

## 设计目标

复用容器终端协议、连接生命周期与状态反馈，明确工具凭据可能修改集群资源。

## 约束与边界

- 仅当前登录用户，不提供任意用户名输入；后端仍负责最终授权。
- 工具部署由集群管理，不由本页面创建或删除。

## UI 交互设计

一个连接入口，在近全屏弹窗中直接键入；方向键、Esc、Ctrl+C 送入远端，可关闭、重连。页面显示操作范围警告。

## 文案与校验

页面文案使用 `kubectl.*`，通用会话状态复用 `container.terminal.*`；未就绪时输入禁用。

## 边界情况

目标接口返回缺少 Pod、项目或容器字段视为错误；403 不自动重试。

## 明确不做

节点 root shell、工具部署和在容器内安装编辑器不属于本功能；已安装的 vim/vi 等交互程序由终端模拟器支持。

## 假设

集群服务 resources v1alpha2 用户 kubectl 查询，且有就绪工具容器与原生 exec WebSocket 支持。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01** — 当前账号目标解析与共享命令终端。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01** — 只读命令输出标记可见，关闭后不再保留浏览器连接。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03`
