# 镜像构建器（L3）

[子模块需求](./_index.md)

## 概述

项目级的镜像构建器列表（旧 console 的 /:namespace/s2ibuilders）：每个 S2I/B2I 构建器一行，展示名称、基础镜像、最近一次构建状态与创建时间。构建器是 devops API 组的命名空间级 CRD，位于 **v1alpha1**；同组的 v1alpha3 只服务流水线/工程等资源，向它请求 s2ibuilders 会得到 404——这是版本拆分，不是功能缺失。

实测（2026-11-15，B200）：/apis/devops.kubesphere.io 列出 v1alpha1 与 v1alpha3；v1alpha1 的资源清单含 s2ibuilders、s2ibuilders/status、s2ibuildertemplates、s2iruns、s2ibinaries；CRD s2ibuilders.devops.kubesphere.io 为 Namespaced、版本 v1alpha1；/apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders 返回 200（列表信封 items），默认项目当前为空，集群 25 个命名空间也都没有构建器；s2ibuildertemplates 有 5 个模板，说明构建链路已安装。

## 用户故事

### US1 - 看到项目里有哪些镜像构建器、它们最近构建得怎么样 (Priority: P1)

作为 **项目运维**，我希望 **在项目里看到已有的镜像构建器及其基础镜像和最近一次构建状态**，以便 **判断某个服务的镜像是否构建成功、是否还在构建中，而不必逐个去看 s2irun**。

**Independent Test**：打开项目的镜像构建器页，页面状态与 API 列表一致：没有构建器时显示空态并说明来源；有构建器时每行显示名称、基础镜像、状态与创建时间；接口失败时显示错误面板与重试。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 已知在 host 集群的某个项目，当打开 /kube-frontend/<workspace>/clusters/host/projects/<namespace>/s2ibuilder，则页面通过 /apis/devops.kubesphere.io/v1alpha1/namespaces/<namespace>/s2ibuilders 读取构建器：没有构建器（当前默认项目为 0）时显示「暂无镜像构建器」空态并说明构建器由 S2I/B2I 构建流程创建、本页只读；有构建器时每行显示名称（displayName 或 name）、基础镜像（spec.config.builderImage）、最近构建状态（status.lastRunState：Running→构建中、Successful→构建成功、Failed→构建失败、空→尚未构建）与创建时间，行数等于接口 items 数；接口 404/5xx 时显示错误面板与重试，而不是空白页；页面不提供创建、编辑、删除或重新构建入口。

## 设计目标

1. 用正确的 API 版本读 S2I 资源：v1alpha1，而不是返回 404 的 v1alpha3。
2. 只读、诚实：没有构建器就是空态并说明来源；不造假行、不提供未实现的写入口。
3. 字段语义与老 console 一致（builderImage、lastRunState、displayName/serviceName 注解）。

## 约束与边界

- 只读 /apis/devops.kubesphere.io/v1alpha1/namespaces/<namespace>/s2ibuilders；kapis 的 v1alpha1 路径也返回 200，但本项目统一直连 /apis 读 CRD。
- 当前集群没有任何 S2iBuilder 实例（默认项目与全部 25 个命名空间均为 0），因此空态是正常状态而非故障。
- 列表按创建时间倒序；构建器是配置对象（每项目少量），分页在前端切，每页 20 行。
- 状态只来自 status.lastRunState；未知值按「尚未构建」展示，不猜控制器语义。
- 基础镜像取 spec.config.builderImage；B2I 或旧对象可能没有该字段，显示 -。
- 无写操作：创建构建器会启动 s2irun，属于独立写流程；本轮只读。

## UI 交互设计

- 页头：标题「镜像构建器」+ 说明「只读展示，创建入口尚未迁移」。
- 表格列：名称（副行类型 S2I/B2I 与所属服务）、基础镜像（等宽、过长省略）、状态徽章、创建时间。
- 空态：暂无镜像构建器 + 来源说明。
- 失败态：错误面板 + 重试。
- 页面句柄：image-builder:surface、image-builder:retry。

## 文案与校验

- 状态：构建中 / 构建成功 / 构建失败 / 尚未构建。
- 名称副行：S2I 或 B2I；有关联服务时显示「服务 <name>」。
- 空态：暂无镜像构建器 / 构建器由 S2I/B2I 构建流程创建；创建入口尚未迁移，本页只读展示项目中已有的构建器。

## 边界情况

- 项目没有任何构建器（当前全部项目如此）：空态，不显示错误。
- 构建器从未运行：lastRunState 为空，显示「尚未构建」。
- 构建器没有 builderImage：基础镜像显示 -，其余列照常。
- 名称/服务注解缺失：名称回退 metadata.name，副行只显示类型。
- API 不可用（组未安装/404）：错误面板 + 重试；不渲染空态冒充成功。
- 列表读取慢：加载骨架；不因慢而重试循环。

## 明确不做

- **创建 / 编辑 / 删除镜像构建器**：创建会启动 S2I 构建（s2irun），属于独立写流程；本轮只读。
- **重新构建 / 查看构建日志 / s2irun 历史**：需要运行记录与流式日志，另立功能点。
- **构建器详情页**：老 console 有详情与运行记录；本轮只迁移列表。
- **任何写接口**：页面不调用 POST/PUT/PATCH/DELETE。

## 假设

- devops 模块已安装且 v1alpha1 的 s2ibuilders CRD 可读（实测可读）。
- 构建器由项目的 S2I/B2I 流程创建，控制台未来再补创建入口。
- 状态字符串来自 controller 的 lastRunState，大小写按原值归一比较。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 通过 v1alpha1 命名空间端点读取 s2ibuilders，页面状态与 items 条数一致。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02** — 行展示名称、基础镜像、最近构建状态、创建时间；状态按 lastRunState 映射。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03** — 空态说明来源，失败态显示错误面板与重试；页面无写入口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 页面读取 v1alpha1 端点且状态与 API 一致；空列表显示空态；请求失败显示重试；全程无写请求。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01`
