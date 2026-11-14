# kubectl 终端（L3）

[关联需求](../../../prd/kube-frontend/cluster-management/kubectl.md)

## 概述

KubectlPage 从 AuthProvider 获取身份，经 kubectlApi 解析用户工具 Pod，再挂载 ExecConsoleDialog。
容器终端共用该近全屏弹窗，ai-kit 的 TerminalView 负责 ANSI、光标、键盘及备用屏幕。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03

## 系统现状

后端 resources v1alpha2 有 GetKubectlPod，返回就绪工具 Pod 的 namespace/pod/container。
BFF 已代理原生 exec，容器终端已实现 v5.channel.k8s.io，不必扩展升级白名单。

## 仓库落点

- `apps/console-next/src/pages/cluster/KubectlPage.tsx` 与集群路由
- `apps/console-next/src/components/resource/ExecConsoleDialog.tsx` 和 ai-kit `terminal/TerminalView.tsx`
- `packages/api-client/src/kubectl.ts` 与 barrel
- `areas/registry.ts`、locales 及对应单测

## 对外契约

GET `/kapis/resources.kubesphere.io/v1alpha2/[clusters/<cluster>/]users/<username>/kubectl`。
host 不加 clusters 段；返回 `{namespace,pod,container}`。目标解析后仍调用原生
`/api/v1/[clusters/<cluster>/]namespaces/<namespace>/pods/<pod>/exec`，协议见 container-detail 技术方案。

## 设计目标与非目标

目标：提供已有工具容器的命令入口；非目标：创建高权限工具或绕过集群 RBAC。

## 关键约束

query key 含 cluster 与 username，点击后才 enabled，不在后台重试。离开页面关闭 socket。
Tab 的 `\t` 与控制键通过 xterm onData 直接写入 stdin；补全和历史属于远端 shell，
不在浏览器伪造候选或把 Tab 当作弹窗导航。默认探测 bash 并以 `-i` 启动，缺失时回退 `/bin/sh -i`。
这一行为与老 console 优先 bash、原样转发输入的交互一致，不复用老实现源码。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01 — 解析工具目标后复用原生 exec

**为什么**：kubectl 是既有 Pod 中的程序；原生 exec 具备双向收发、鉴权与已验证代理。
复用 ExecConsoleDialog 消除状态处理重复，键盘与原始格式直接送入模拟器。

**被否方案**：直接创建 cluster-admin Pod 或代理任意终端路径；增加未授权部署与协议范围。

**何时重新考虑**：需要全屏终端能力或后端不再提供用户工具 Pod 时。

## 不变量

1. 用户名来自登录身份，未提供自由文本目标。
2. 连接前目标必须完整，失败不回落系统 Pod。
3. 页面卸载销毁会话，不删除服务端工具容器。

## 已知坑

- 工具容器凭据可能是集群管理员凭据，页面必须明确警告，权限最终由后端控制。
- 浏览器 WebSocket 不暴露握手 HTTP 错误详情，发现请求可显示 403，握手失败只报连接拒绝。
- vim/vi 需要目标容器已经安装，客户端仅负责模拟器，不在生产容器安装程序。

## 测试与可观测

API 单测覆盖编码、无账号、缺失字段与错误；共享终端单测覆盖点击、命令、输出和卸载。
B200 E2E 只执行 printf 与 kubectl 只读版本查询，不创建工作负载。
句柄为 `kubectl:prepare/terminal/terminal-output/terminal-close`；键盘使用模拟器 textarea。

## 后续改进

节点 shell 需独立权限与特殊协议，不因复用终端而视为已迁移。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03`
