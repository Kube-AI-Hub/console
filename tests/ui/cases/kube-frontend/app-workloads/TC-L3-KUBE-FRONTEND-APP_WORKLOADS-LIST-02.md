# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02 工作负载列表 · 按名称搜索

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

在搜索框输入名称的一部分后，列表只保留匹配行，并把关键词下发到服务端。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02** — 已知列表有数据，当在搜索框输入对象名的一部分，则只剩匹配行。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 由用例的 fixture 创建两个 tc-e2e- 前缀的部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开部署列表，确认两个目标行都在
2. 在搜索框输入其中一个名称的独有片段
3. 读取当前行与搜索请求

## 期望结果

- 只剩包含该片段的行，另一个部署的行消失
- 搜索请求带 name=<片段> 且 page=1
- 清空搜索后目标行重新出现

## 失败排查

- 搜索无效时先看请求是否带 name 参数；本地过滤不算通过
- 行仍停留在旧关键词时看防抖与页码是否同步

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 句柄变化时改 pages/app_workloads.py
