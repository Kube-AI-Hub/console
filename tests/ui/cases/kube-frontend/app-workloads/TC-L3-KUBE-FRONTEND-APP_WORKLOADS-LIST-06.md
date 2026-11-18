# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06 容器组列表 · 所在节点列是节点详情链接

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

「所在节点」列显示节点名与节点 IP（status.hostIP）并链接到该集群的节点详情；未调度的容器组该列是纯文本「-」，不生成链接。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-06** — 已知容器组已调度，当打开容器组列表，则「所在节点」列显示节点名与节点 IP，且是链接到该集群的节点详情；未调度的容器组该列显示「-」且不是链接。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建一个永远调度不出去的容器组（nodeSelector 指向不存在的节点），用例结束后无条件删除

## 测试步骤

1. 用 API 读容器组列表，挑一个已调度的（spec.nodeName 与 status.hostIP 都非空）并记录两个值
2. 打开容器组列表，等列表就绪
3. 在已调度那一行里读 pods:node:<行名> 的文本与 href
4. 在本用例创建、未调度的那一行里读「所在节点」单元格的文本，并确认该行没有 pods:node:<行名>

## 期望结果

- 已调度行的节点列文本同时含节点名与节点 IP
- 该节点列是链接，href 以 /clusters/<cluster>/nodes/<node> 结尾（集群作用域，不含 projects 段）
- 未调度行该列显示「-」且不是链接（没有 a[href]）

## 失败排查

- 节点列不是链接：节点渲染退回了纯文本；或 href 拼成了 projects/<ns>/nodes/…
- 全部显示 -：读的是工作负载模板而不是 Pod 对象
- 未调度行仍可点：nodeName 为空时没有走「不造链接」分支

## 产品改版后如何更新自动化

- 句柄见 WorkloadListPage.tsx 的 pods:node:<行名>；节点路由见 routes/kube-frontend.clusters.$cluster/nodes
