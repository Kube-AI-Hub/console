# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01 工作负载列表 · 表格列与可点击名称

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

部署列表以表格展示名称、状态、就绪与创建时间，名称是进入详情的链接。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01** — 已知项目内至少有一个部署，当打开部署列表，则出现表格且每行有可点击的名称。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署列表
2. 核对表头顺序
3. 读取目标行的名称链接、状态徽章与就绪计数
4. 点击名称进入详情

## 期望结果

- 表头依次为 名称、状态、就绪、创建时间
- 目标行出现，名称是链接且 data-ai-id 为 deployments:open:<name>
- 状态徽章显示「更新中」，就绪列显示 0/1
- 点击名称后 URL 以 /deployments/<name> 结尾

## 失败排查

- 行不存在时先确认对象已创建，再确认列表请求带了排序参数
- 名称不可点时检查 ResourceList 的 render 是否仍输出 <a>

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 句柄变化时改 pages/app_workloads.py
