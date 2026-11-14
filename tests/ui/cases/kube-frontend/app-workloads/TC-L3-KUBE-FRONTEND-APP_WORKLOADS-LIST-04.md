# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04 容器组列表 · 节点与 Pod IP 列

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/public/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

容器组列表显示「所在节点」与「容器组 IP」两列，值来自 Pod 对象的 spec.nodeName / status.podIP。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04** — 已知容器组列表有数据，当打开容器组页，则除名称/状态/创建时间外还显示「所在节点」与「容器组 IP」两列，其值分别等于该容器组对象的 `spec.nodeName` 与 `status.podIP`（未调度时显示 -）。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 已登录，且对 default 项目有读取权限
- 项目里至少有一个容器组

## 测试步骤

1. 用 API 取容器组对象，记录 nodeName 与 podIP
2. 打开容器组列表
3. 核对表头包含「所在节点」「容器组 IP」
4. 核对这两个值与该对象一致（未调度时显示 -）

## 期望结果

- 两列表头存在
- 已调度容器组的节点与 IP 与对象一致

## 失败排查

- 列为空：summary 映射没读 spec.nodeName/status.podIP
- 全部显示 -：读的是工作负载模板而不是 Pod 对象
- 想加状态筛选：kapis 代理忽略 status.phase fieldSelector（实测 0 条），不要放该控件

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py 与 WorkloadListPage.tsx
