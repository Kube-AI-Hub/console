# 集群级工作负载 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-workloads.md)

## 概述

七类工作负载的跨项目列表，共用一个页面组件，按 `kind` 区分。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02

## 设计目标与非目标

目标：七页一套列语义与链接规则。非目标：集群级创建、筛选（代理不支持 fieldSelector）。

## 关键约束

- `GET /kapis/resources.kubesphere.io/v1alpha3/<kind>`（无 namespace = 跨项目）。
- 项目 → workspace 读一次命名空间列表建索引（同 `cluster-pods`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01 — 一个组件 + 七个路由，而不是七个页面

**为什么**：七页的列、链接、分页、搜索完全一致，唯一变量是 `kind`；七个文件会让「改一处列」变七处。
**被否方案**：每类一个页面文件。重复代码会分叉（项目页已经有这个教训）。
**何时重新考虑**：某一类需要专属列/操作时（届时用 kind 分支，不复制文件）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02 — 就绪列按类型有无渲染

**为什么**：`ready/total` 只对控制器有意义；服务与路由没有副本概念，显示 `0/0` 会被读成「全部不可用」。
**被否方案**：统一显示数字。
**何时重新考虑**：为服务/路由引入各自的健康指标时。

## 系统现状

老 console：集群 → 工作负载 → 七类列表（列含 PROJECT）。本组页面迁移这七页；容器组单独一页（多节点/IP 两列）。创建流程需先选项目，属另一交互，本轮不做。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterWorkloadsPage.tsx`
- 路由：`routes/kube-frontend.clusters.$cluster/{deployments,statefulsets,daemonsets,jobs,cronjobs,services,ingresses}/`
- 注册：`areas/registry.ts`（新分组 `cluster.nav.groupWorkload`）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 工作负载（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/&lt;kind&gt; |
| 命名空间（取 workspace） | /kapis/resources.kubesphere.io/v1alpha3/namespaces |

## 不变量

1. 首页行数 = min(pageSize, total)，默认 pageSize=20。
2. 项目列 = 对象命名空间。
3. 链接含 workspace 与项目段。

## 已知坑

- **registry path 单段**：不能写 `workloads/deployments`，契约会拒绝。
- **英文词典要单独加**：只加中文时 `tsc` 报 `Record<LocaleKey,string>` 缺键。
- **代理不支持 fieldSelector**：筛选不做（§52）。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01.yaml`
可观测点：`cluster-deployments:surface`（按 kind 前缀）、`cluster-<kind>:name:<name>`。

## 后续改进

- 集群级 secrets/configmaps/serviceaccounts（同模式）。
- 集群级创建（需先选项目）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03 — 分页与刷新复用共享能力

**为什么**：七类页面接入同一个 `ResourceList` 和 `useResourceListState`，pageSize 同时进入查询键、
请求 limit 与分页器。换档位同步回第一页、清空选择，但搜索和排序不变；刷新调用当前查询 refetch。
数据占位仅允许相同资源类型和集群；区域及刷新按钮标记忙碌，减少翻页时内容消失。
每页条数有独立的中英文可访问名称和稳定句柄 `cluster-<kind>:page-size`。
**被否方案**：每类各写分页状态；档位和页码会出现行为分叉。无条件旧数据占位会在类型或集群切换后展示错误对象。
**何时重新考虑**：某资源改为游标分页或不再支持 limit 参数时。

## 组件与测试补充

- ai-kit 不新增组件；扩展分页控件的可访问标签和稳定句柄，并让刷新控件独立可见、反馈 busy。
- Storybook：`Schema/ResourceList` 演示刷新、搜索及档位；`Components/Pagination` 演示档位重置页码。
- 单测：八类列表请求参数、刷新后的新数据、同名对象行键与占位边界；E2E 遍历七类页面验证 limit、页码、空态刷新。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03 — 集群级负载补「按项目筛选」与三类写入口

**为什么**：集群级负载页此前只有关键字搜索，回答不了「这个项目里有什么」；旧 console 的集群页有项目下拉（可搜索/翻页/清空）。写入口同理：找到对象后不能改，等于再跳一次项目页。

**筛选走服务端**：`namespace` 参数由筛选值决定，空值仍是跨项目读取——这样分页与总数都由上游算，而不是把跨项目全量拉到前端再过滤。

**写按行所属项目寻址**：列表跨命名空间，用页面自己的（空）命名空间会拼出没有 `namespaces/<ns>` 段的路径，404 而对象还在。

**批量删除按项目分组发请求**：上游没有跨命名空间的事务，一次 DELETE 只能针对一个命名空间；分组后每组一次请求，部分失败仍然可见（刷新后仍存在的行就是证据），选中在成功后才清空。

**只补三类通用动作**：重新部署、扩缩容这类动作每种负载的规则不同（Job 不能扩缩容、Service 没有副本），属于项目页的职责；集群页给「找到并清理」这一层。

**被否方案**：把集群级负载做成项目页的筛选（像配置字典那样合并成一个页面）。工作负载的列、动作和详情都按 kind 分支，合并后一个页面的分支会比现在多得多，且会让项目作用域与集群作用域的权限边界混在一起。

**何时重新考虑**：若上游提供跨命名空间的批量删除接口，分组逻辑可去掉。

