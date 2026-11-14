# 编辑 YAML 覆盖（L3）

[子模块需求](./_index.md)

## 概述

节点、持久卷、存储类型与网络策略的详情页都提供「编辑 YAML」。这四类对象在老 console 里都能通过 YAML 弹窗修改，新 UI 之前只读：节点详情没有编辑入口，持久卷与存储类型页甚至写明「有意只读」，网络策略则连详情页都没有。

本功能把四类详情页接到同一个 `YamlDialog` 与同一条写路径上：读取当前对象作为初始文档、锁定名称、按对象所属 API 组 PUT、失败留在弹窗里。列表页的编辑能力不改。

## 用户故事

### US1 - 在只读详情页上改一处 YAML (Priority: P1)

作为 **集群管理员**，我希望 **在持久卷/存储类型/节点/网络策略的详情页直接编辑 YAML 并保存**，以便 **改列表没暴露的字段时不必依赖 kubectl 与 kubeconfig**。

**Independent Test**：打开一个存储类型详情，点「编辑 YAML」，给对象加一个注解并保存，回读对象确认注解存在且名称未变。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01** — 已知节点、持久卷、存储类型与网络策略的详情页各有「编辑 YAML」入口；当在存储类型详情里打开该弹窗、修改一处注解并保存，则对象被更新（回读注解一致、名称不可修改）；当编辑后的 YAML 不能解析或名称被改，则提交被拦下并提示；服务端拒绝或资源版本冲突时弹窗保持打开并显示错误。

## 设计目标

1. **一套编辑器**：四类详情页复用 `components/resource/YamlDialog`，不写第二份。
2. **写路径正确**：核心组走 `/api/v1`，其余走 `/apis/<group>/<version>`；存储类型的组必须登记，否则写入静默 404。
3. **网络策略可达**：为项目作用域补一个详情页，让「编辑 YAML」有落点；创建/删除仍在网络隔离页。

## 约束与边界

- 名称锁定：`YamlDialog` 的 `lockName` 校验 `metadata.name`；改名不是 Kubernetes 支持的操作。
- 写策略：先读当前对象拿 `resourceVersion`，再整对象 PUT；对象在弹窗打开期间被改动时返回 409。
- 持久卷页面仍不提供删除：卷通常只有一份数据，`reclaimPolicy: Delete` 会在删除对象时销毁后端存储。
- 网络策略详情页在项目作用域（`…/projects/<ns>/networkpolicies/<name>`）；集群级跨项目列表仍只读。
- 详情页只新增一个操作，不改既有区块的 `data-ai-id`。

## UI 交互设计

- 详情页头部右侧一个「编辑 YAML」按钮（`node-detail:edit-yaml` / `pv-detail:edit-yaml` / `sc-detail:edit-yaml` / `networkpolicy-detail:edit-yaml`）。
- 点击打开 `YamlDialog`：预填当前对象、名称只读、支持上传/下载；保存期间按钮 pending。
- 保存成功关闭并刷新详情；解析失败、名称被改、服务端拒绝、409 冲突都在弹窗内提示且不关闭。

## 文案与校验

- 复用既有文案：`resource.action.editYaml`（编辑 YAML）、`yaml.invalid`（YAML 格式有误，请修正后再提交。）、`yaml.nameLocked`（已有对象不支持改名…）。
- 解析失败时该文档不能提交；名称与锁定的对象名不一致时同样不能提交。

## 边界情况

- 对象已被删除：详情查询报 404，页面走错误态与重试。
- 写入被拒（字段不可变、权限不足）：弹窗保留文本并显示服务端消息。
- 存储类型被现有 PVC 引用：部分字段不可改，由服务端拒绝并提示。
- 网络策略所属项目未知：集群级列表已反查 workspace，链接进入项目作用域详情。
- 编辑 YAML 与「编辑设置」同时可用于同一对象：两者写同一条 PUT 路径，后保存者的 409 提示刷新。

## 明确不做

- 不做多文档 YAML 与 CRD 实例的 YAML 编辑（后者在 parity 报告登记为有意不迁移）。
- 不在列表页新增「编辑 YAML」入口；只补详情页。
- 不给持久卷/存储类型补删除入口（理由见约束）。
- 不实现节点污点/标签的专用编辑器；这些字段通过编辑 YAML 修改。

## 假设

- 操作者对目标对象有 update 权限；集群已开启 `storage.k8s.io` 与 `networking.k8s.io` API。
- kapis 详情响应可直接序列化成初始 YAML 文档。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01**：系统必须在节点、持久卷、存储类型与网络策略的详情页提供「编辑 YAML」，复用同一编辑器与同一写路径，并在失败时保留弹窗与错误信息。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01**：四类详情页都能打开预填当前对象的编辑器；在存储类型上保存一处注解后回读一致，名称未变；非法 YAML 与改名被拦下。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01`
