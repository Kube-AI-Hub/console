# 负载详情（L3）

[子模块需求](./_index.md)

## 概述

点列表名称进入详情：属性、容器镜像与操作都在这一页，面包屑给出「工作台 / 应用负载 / 部署 / 对象名」。

## 用户故事

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-PODS_BLOCK-01** — 已知一个部署有就绪的容器组，当打开其详情，则显示「关联容器组」表（容器组名称、状态、所在节点、重启次数、创建时间），行数与该部署选择器匹配到的 Pod 数一致；当点击其中的容器组名称，则跳转到该容器组的详情页。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-05** — 已知一个 ClusterIP 服务有端口 80→8080，当打开其详情，则显示端口表，列为端口名、服务端口、容器端口、节点端口，且服务端口为 80、容器端口为 8080、节点端口为 `-`。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-04** — 已知一个部署配置了自动伸缩（1–3 副本、CPU 30%），当打开其详情，则显示自动伸缩区块含策略名、副本范围与触发指标；已知另一个部署没有自动伸缩，则其详情不显示该区块。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-03** — 已知打开一个容器组的详情，则属性含状态、所在节点、容器组 IP、节点 IP、QoS 等级与重启次数；已知打开一个服务的详情，则属性含服务类型、虚拟 IP、外部地址、选择器与会话亲和性。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01** — 已知列表里有一个部署，当点击名称，则进入 `…/deployments/<name>` 并显示属性与容器镜像。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02** — 已知在详情页，当点返回链接，则回到同一项目的列表，页签仍高亮。

## 设计目标

落实「区域内切换保持上下文」：详情与列表属于同一功能区，页签与工作区栏不重建。

## 约束与边界

- 详情读 kapis 单个对象，属性来自对象本身。
- 「副本」只在有副本概念的资源上显示。

## UI 交互设计

标题与状态徽章在上，操作在右，属性块与镜像块在下。

## 文案与校验

- 属性名：集群、项目、应用、副本、创建时间、创建者。

## 边界情况

- 对象不存在：提示并给返回列表入口。
- 加载中显示骨架。

## 明确不做

- 不在详情做扩缩容（表单能力未迁移，记在待办）。

## 假设

- 对象名即路由参数，不额外请求列表。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-03** — 详情按资源类型补充专属属性，与老 console 的字段一致。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-04** — 有自动伸缩的负载显示其策略，没有的不显示。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-05** — 服务详情显示端口表，无节点端口的显示 `-`。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-06** — 部署/有状态副本集/守护进程集详情列出关联容器组。

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01** — 展示属性与容器镜像。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02** — 提供重新部署、编辑 YAML、删除。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01** — 首屏骨架 200 ms 内出现。
