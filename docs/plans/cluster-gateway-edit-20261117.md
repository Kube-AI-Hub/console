# 集群网关编辑与详情元数据/资源状态（2026-11-17）

> 本批交付证据。范围：N-29 的集群网关**编辑**与**详情元数据**单元 —— 复用项目网关编辑对话框；详情新增 labels/annotations/resourceVersion 区块。创建/删除按职责边界不提供（安装器所有 / 删除会移除集群入口控制器）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群管理员修改集群网关的类型/副本/追踪/NodePort |
| 旧入口、部署 URL | 老 console 集群网关卡片编辑；新 UI 集群网关页此前只读 |
| 新入口 | /kube-frontend/clusters/<cluster>/gateways/cluster → 行操作「编辑」 |
| 环境、集群、角色 | B200 host；admin；集群网关 kubesphere-controls-system/kubesphere-router-kubesphere-system（控制器 Deployed） |
| 视口、主题 | 1600×1000（编辑对话框截图） |
| 子页面与状态范围 | 编辑对话框（无修改保存验证 PATCH 路径）；失败保留对话框 |
| 明确排除及批准 | 集群网关创建/删除：安装器 Helm release 所有；删除会移除入口控制器 |
| 并行/安全边界 | E2E 以**未修改表单保存**验证写路径，不改真实配置 |

## 2. 旧能力与归宿

| 旧能力 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- |
| 集群网关编辑（类型/副本/追踪/NodePort） | 集群网关页签行操作，复用 GatewayEditDialog | AC-CLUSTER_GATEWAYS-03；TC-…-03 | 通过（B200 6.07s） |
| 集群网关创建 | 不提供（安装器 release） | 设计 DEC-04 | 登记 |
| 集群网关删除 | 不提供（会移除入口控制器） | 设计 DEC-04 | 登记 |
| 项目网关编辑/删除 | 既有项目网关页与项目页签 | 既有 | 既有 |

## 3. 数据契约

| 能力 | 请求 | 规则 |
| --- | --- | --- |
| 列表 | GET /apis/gateway.kubesphere.io/v1alpha1/gateways（经 BFF） | 集群/项目作用域按命名空间区分 |
| 编辑 | PATCH /apis/gateway.kubesphere.io/v1alpha1/namespaces/<ns>/gateways/<name>（merge-patch） | 复用 projectGatewaysApi.update；无修改时提交相同值 |
| 权限 | SSAR update gateways（namespace） | 显式 false 隐藏编辑 |

## 4. 验证结果

| 项 | 结果 |
| --- | --- |
| E2E TC-CLUSTER_GATEWAYS-03 | **1 passed（6.07s）**：集群页签行菜单「编辑」→ 对话框带网关名 → 未修改保存 → 关闭无错误 → 回读对象仍在 |
| E2E TC-GATEWAY_DETAIL-02 | **1 passed（5.95s）**：详情元数据区块显示 annotations（kubesphere.io/creator 等）与 ResourceVersion |
| E2E TC-GATEWAY_DETAIL-03 | **1 passed（7.57s）**：资源状态区块显示控制器 Deployment 副本与至少一个 Pod 行 |
| E2E TC-GATEWAY_DETAIL-04 | **1 passed（7.80s）**：日志区块读取 controller 容器最近 200 行，文本非空 |
| E2E TC-GATEWAY_DETAIL-05 | **1 passed（6.62s）**：监控区块 CPU/内存卡片；本部署未上报 ingress 指标时显示明确说明 |
| 清理 | 无新建/删除对象；真实配置未变更 |
| 截图 | cluster-gateway-edit-dialog.png |
| 批量回归 | 网关 5 条 + 节点添加 1 条 + 自制应用 9 条 = **15 passed / 64.38s**（B200，一次进程） |
| 静态 | 本轮改动仅页面 schema；tsc/build 通过（后续统一回归） |
| 门禁 | roles 文档严格门禁 errors=0（见本轮输出） |

## 5. 剩余

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| 网关详情 4 页签：元数据、资源状态、日志、监控均交付；创建/删除按职责边界不做 | 完成（除明确排除） | — |
| 旧站对照、非 admin、部署/全站 | 未验收 | 后续 |
| 创建/删除集群网关 | 明确不做 | 需要安装器上下文或安全删除流程 |
| 旧站对照、非 admin、部署/全站 | 未验收 | 后续 |

## 6. 流程反思

| 事 | 写入 |
| --- | --- |
| 编辑 E2E 用「未修改保存」验证写路径，避免改动线上入口控制器配置 | 记录本节 + 用例注释；写类用例优先无副作用验证 |
| 设计文档已有 DEC-03（写能力重纳），新决策必须用新编号 | DEC-04；每次加决策先搜同编号 |
