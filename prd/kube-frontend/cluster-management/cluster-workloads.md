# 集群级工作负载（L3）

[子模块需求](./_index.md)

## 概述

集群内全部控制器类工作负载的跨项目列表：部署、有状态副本集、守护进程集、任务、定时任务、服务、应用路由（容器组见 [`cluster-pods.md`](./cluster-pods.md)）。每行带**项目列**，名称链到该项目内的详情页。

老 console 把这七页放在集群导航的「工作负载」分组下。项目级页按定义只能看一个项目，回答不了「集群里有哪些、属于谁」。

## 用户故事

### US1 - 跨项目盘点工作负载 (Priority: P1)

作为 **集群管理员**，我希望 **在不知道项目的情况下按类型盘点工作负载**，以便 **先找到对象，再进到它所属的项目处理**。

**Independent Test**：打开集群级部署页，核对行数等于接口首页条数、项目列等于对象命名空间、名称链接含 workspace 与项目段。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01** — 已知集群里有部署、服务等工作负载，当打开对应集群级页面，则列出名称、项目、状态、就绪数（有副本概念的类型）、镜像与创建时间；每页行数等于 `min(20, total)`；名称链接指向该对象所属项目内的详情页（URL 含 workspace 段与项目段）；七类页面（deployments/statefulsets/daemonsets/jobs/cronjobs/services/ingresses）都从侧栏「工作负载」分组可达。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03** — 已知集群级工作负载列表里有一个普通部署与一个联邦托管的部署，当用「项目」筛选选择某个项目，则列表只显示该项目的对象且请求带该命名空间；清空筛选回到全部项目；打开普通行的更多操作提供「编辑信息 / 编辑 YAML / 删除」，联邦托管行不渲染操作；编辑信息保存后按**该行自己的项目**更新注解；勾选多行批量删除时按行所属项目分别发出删除请求，完成后列表刷新且选中清空。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02** — 七类列表均可切换 10/20/50/100 每页条数，默认 20；切换档位回到第一页并保留搜索、排序；刷新重新读取当前档位与条件，进行中有忙碌反馈，失败显示错误。翻页保留已有内容，但不同资源类型或集群之间不复用旧数据占位。

## 设计目标

1. 七页共用一套列语义与链接规则。
2. 行内能进到对象所属项目。

## 约束与边界

- 读集群级集合（`namespace=''`）。
- 只读。

## UI 交互设计

- 侧栏新增「工作负载」分组，其下七项 + 容器组。
- 列为：名称（链接）、项目、状态、就绪、镜像、创建时间；窄屏折叠后三列。
- 搜索框即时响应输入，防抖后查询；搜索旁统一刷新，分页器提供每页档位。

## 文案与校验

- 空态：没有对象 / 当前条件下没有对象。
- 空值 `-`。

## 边界情况

- workspace 解析失败：链接回落 `public`。
- 无副本概念的类型（服务/路由）：就绪列显示 `-`。

## 明确不做

- 按项目/状态筛选：kapis 代理不支持 `fieldSelector`（§52 实测），不放死控件。
- 在集群级页面直接创建：老 console 创建需先选项目，属另一交互，另立。

## 假设

- 项目归属由命名空间的 `kubesphere.io/workspace` 标签给出。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01** — 七类工作负载的跨项目列表。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02** — 项目列与写回项目详情的链接。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03** — 七类列表共用分页档位和当前条件刷新。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01** — 行数 = min(20,total)；链接段正确；七页均可从侧栏到达。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02`
