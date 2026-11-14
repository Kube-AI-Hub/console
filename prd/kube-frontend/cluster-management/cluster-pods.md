# 集群级容器组（L3）

[子模块需求](./_index.md)

## 概述

集群内全部容器组，一行一个 Pod，带**项目列**（并链到项目内的 Pod 详情）：节点、Pod IP、状态、创建时间。

老 console 把它放在集群导航的「工作负载 › 容器组」。项目页的容器组列表按定义只能看一个项目，回答不了「集群里现在跑着什么」。

## 用户故事

### US1 - 集群里此刻有哪些容器组 (Priority: P1)

作为 **集群管理员**，我希望 **跨项目查看容器组**，以便 **在不知道属于哪个项目时先找到它**。

**Independent Test**：打开集群级容器组页，核对行数等于接口首页条数，项目列等于对象所在命名空间，名称链接带正确 workspace 段。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01** — 已知集群有容器组，当打开集群级容器组页，则列出名称、项目、状态、所在节点、容器组 IP 与创建时间；每页行数等于 `min(20, total)`；名称链接指向该容器组所属项目内的 Pod 详情（URL 含 workspace 段）；按名称搜索时结果收窄。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02** — 在容器组列表或空态点击刷新时，重新读取当前搜索、排序和分页对应的容器组；请求期间显示刷新中，结束后展示最新结果，失败时显示错误与重试入口。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-03** — 默认每页 20 条，可切换 10/20/50/100 条；从非首页切换档位时回到第一页，保留搜索和排序，请求携带新 limit；刷新保留该档位。翻页和搜索期间保留已有内容并标明忙碌，不以旧集群数据占位。

## 设计目标

1. 一屏回答「集群里跑着什么」。
2. 行内能进到对象所在项目的详情页。

## 约束与边界

- 读集群级集合（`namespace=''`，即跨项目）。
- 只读。

## UI 交互设计

- 列表六列；窄屏隐藏节点/IP/创建时间。
- 名称列是链接，指向 `/<workspace>/clusters/<cluster>/projects/<ns>/pods/<name>`。
- 搜索栏旁提供刷新入口，刷新时保留当前条件并反馈进行中。
- 分页档位沿用旧版选择，默认保持当前新 UI 的 20 条；搜索输入即时反馈，请求仍防抖。

## 文案与校验

- 空态：没有容器组 / 当前条件下没有对象。
- 空值显示 `-`。

## 边界情况

- 未调度 Pod：节点与 IP 显示 `-`。
- workspace 解析失败：链接回落到 `public` 并仍指向正确项目。

## 明确不做

- 状态/节点筛选：kapis 资源代理不支持 `fieldSelector`（实测返回 0 条，§52），不放死控件。
- 在工作负载其它 7 类上同时开集群页：本轮先交付容器组，其余按同一模式后续补。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01** - 跨项目列出容器组，带项目列与详情链接。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02** - 名称搜索走服务端关键字。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-03** - 按当前条件手动刷新容器组列表。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-04** - 支持每页档位，切换时回到第一页。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01** - 行数 = min(20, total)；项目列与链接段正确。

## 假设

- 项目归属由命名空间上的 `kubesphere.io/workspace` 标签给出。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-03`
