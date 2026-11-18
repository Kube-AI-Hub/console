# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07 容器组列表 · 状态徽标之后显示状态原因

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

容器组的状态原因（如 ContainerCreating / CrashLoopBackOff）显示在状态徽标之后；原因与阶段同名（Running / Pending）时不显示，行里只有徽标。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07** — 已知某容器组的容器处于等待或终止并带原因（如 CrashLoopBackOff），当打开容器组列表，则该行状态列在状态徽标之后显示该原因；没有原因的行只显示徽标。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建两个容器组：一个镜像拉不下来（容器等待原因 ContainerCreating）、一个 nodeSelector 指向不存在的节点（原因为阶段名，无额外原因）；用例结束后无条件删除

## 测试步骤

1. 打开容器组列表，等列表就绪
2. 在有等待原因的那一行里读 pods:reason:<行名> 的文本，并核对它在状态列内、位于状态徽标之后
3. 在只有阶段名的那一行里确认不存在 pods:reason:<行名>
4. 用 API 逐行核对：页面上出现 pods:reason 的行集合等于「API 里原因比阶段更有信息」的行集合

## 期望结果

- 有等待原因的容器组行出现 pods:reason:<行名>，文本是 API 原文（ContainerCreating 等），与徽标同列且在徽标之后
- 没有额外原因的行不存在 pods:reason:<行名>，状态列只有徽标
- 页面显示原因的行集合与按 API 派生的一致，不多不少

## 失败排查

- 原因不出现：读成了 status.reason（多数 Pod 没有），真实原因在容器 state.waiting.reason；init 容器要看 initContainerStatuses
- Running 行也有原因：少了「原因与阶段同名则不显示」的判定
- 原因在名称列：渲染位置回到了旧版名称下方

## 产品改版后如何更新自动化

- 句柄见 WorkloadListPage.tsx 的 pods:reason:<行名>；派生规则见 api-client 的 podStatusReason / isInformativeReason
