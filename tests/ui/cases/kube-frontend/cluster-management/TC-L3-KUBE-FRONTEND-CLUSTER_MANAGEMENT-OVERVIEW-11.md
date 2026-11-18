# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-11 集群概览 · 未就绪集群显示等待加入引导

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-11`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{notReadyCluster}/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

未就绪集群的概览整页让给「等待集群加入」，代理集群给出三步接入引导，就绪后自动切换回完整概览。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-12** — 集群未就绪时（Ready 条件非 True）概览页**整页**替换为「等待集群加入」：保留页头（集群名、暂停/刷新、kubectl），其下只渲染一个等待面板，不渲染资源用量、节点块、排行、基本信息、Kubernetes 状态、组件、模块与快捷入口（这些面板在未就绪集群上没有可读数据，保留只会把唯一下一步淹没）。等待面板含加载指示、`WAIT_FOR_CLUSTER_DESC` 说明、控制器 `readyMessage`（有则显示，无则省略，不与固定文案重复）；`connectionType=proxy` 时额外渲染三步代理接入引导——`vi agent.yaml`、复制清单到 `agent.yaml`、`kubectl create -f agent.yaml`——命令以行内 code 呈现且文案中不留占位符或重复命令，清单取自代理接口并带复制按钮；接口不可用时说明平台可能未部署 tower 并显示原始原因，而不是只报「未找到」。序号由列表样式生成，不写进翻译文案。面板内提供手动刷新，自动刷新开启时说明本页会自行更新。集群变为就绪后无需刷新即切换到完整概览；`connectionType=direct` 的未就绪集群不显示代理步骤。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/overview.md`](../../../../design/kube-frontend/cluster-management/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开集群先看整体是否正常 (Priority: P1)

作为 **集群管理员**，我希望 **进入集群的第一屏就能看到就绪状态、版本、节点数与资源用量**，以便 **不必先点进节点或监控才能判断这个集群能不能用**。

**Independent Test**：打开集群概览，核对「基本信息」与「资源用量」两块都渲染出真实值，且状态徽标与集群对象的 Ready 条件一致。

### US5 - 优先定位资源压力并查看变化 (Priority: P1)

作为 **集群运维人员**，我希望 **先看资源总量/用量和节点排行，并切换资源趋势**，以便 **快速定位压力与异常节点**。

**Independent Test**：资源和排行先于身份信息；切换资源与1h/6h/24h，趋势与同次历史响应对账；默认30秒更新，可暂停，隐藏页面不继续轮询。

## 前置与配置

- 已登录，存在一个 Ready 条件非 True 的集群；代理集群的接入清单接口可用

## 测试步骤

1. 打开未就绪集群的概览，等待集群对象返回
2. 核对页头保留集群名、暂停/刷新与 kubectl，其下只有等待面板
3. 核对资源用量、节点块、排行、基本信息、Kubernetes 状态、组件、模块与快捷入口均未渲染
4. 核对等待面板含加载指示与说明文案，且不重复提供刷新按钮（刷新只在页头一处）
5. 代理集群：核对三步引导的顺序与命令，命令以行内 code 呈现且不重复
6. 核对文案中不残留 `{cmd}`、`{file}` 等占位符
7. 清单接口不可用时核对显示 tower 说明与原始原因，而非仅「未找到」
8. 让集群变为就绪，核对页面无需刷新即切回完整概览

## 期望结果

- 等待面板可见，页头控件仍可用；`overview:usage-*`、`overview:node-row`、`overview:ranking`、`overview:basic`、`overview:kubernetes-status`、`overview:components`、`overview:shortcuts` 全部不存在
- 代理集群渲染 `overview:agent-steps` 且恰好三项，序号由列表样式生成而非写在文案里
- 三步文案分别包含 `vi agent.yaml`、`agent.yaml`、`kubectl create -f agent.yaml`，各出现一次
- 清单用共享 `YamlEditor`（CodeMirror）只读展示：有行号与语法高亮，可滚动查看完整文档，复制按钮在文档下方
- `connectionType=direct` 的未就绪集群不渲染 `overview:agent-steps`
- 控制器有 readyMessage 时显示原文，无则不显示；「本页会自动刷新」只出现一次
- 整页只有一个刷新按钮（页头 `overview:refresh`），等待面板内不出现 `overview:waiting-refresh`
- 集群就绪后完整概览出现，等待面板消失

## 失败排查

- 等待面板不出现：先看集群对象的 Ready 条件，`toClusterDetail` 只认 `status=True`
- 步骤命令重复：检查是否把命令同时作为 `t()` 参数和 `step()` 的分隔 token
- 序号不显示：`<ol>` 需 `list-decimal`，不要用 `content-[counter(...)]`

## 产品改版后如何更新自动化

- 等待面板结构变化时改 pages/cluster_overview.py 与 test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_11.py
