# TC-CORE-KUBE_FRONTEND-01 新前端 · 入口与页面骨架

- **用例 ID**: `TC-CORE-KUBE_FRONTEND-01`
- **级别**: L1  **套件**: `core`
- **模块**: `kube-frontend` / `configmaps` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/_index.md`

## 产品功能

新前端能独立提供配置字典页，且与老 console 同一命名空间下看到同一批对象。

### 关联需求

- `prd/kube-frontend/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/_index.md`](../../../../prd/kube-frontend/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-CORE-KUBE_FRONTEND-01** — Given 新前端与老 console 同时运行，When 访问新前端的配置字典页，Then 列出的对象与老 console 同一 namespace 的列表一致。

### 关联设计

- 技术方案 [`design/kube-frontend/_index.md`](../../../../design/kube-frontend/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/_index.md`](../../../../prd/kube-frontend/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为平台工程师，看到迁移后的配置字典页面与老控制台行为一致


**Independent Test**：打开 `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/configmaps`，能列出真实 ConfigMap、按名称搜索、按名称与创建时间排序、翻页，结果与老控制台同一 namespace 下一致。

### US2 - 作为智能体，在不知道页面文案的情况下完成一次删除


**Independent Test**：只使用 `data-ai-id` 与 `data-ai-state` 两个属性，选中一行、触发批量删除、确认，观察页面回到 `ready` 且该行消失。

### US3 - 作为在手机上检查异常的用户，能看清列表并完成一次搜索


**Independent Test**：在 375px 宽视口打开列表，页面无横向滚动，导航收进抽屉，搜索框与操作按钮高度不小于 44px。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该空间下至少有一条 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps
2. 记录列表中的对象名称
3. 在老 console 打开同一空间的配置字典页
4. 对比两边的名称集合

## 期望结果

- 新前端页面渲染出版头、工具条与列表
- 两边名称集合一致
- 新前端不出现老 console 的侧栏与页头

## 失败排查

- 名称不一致时先确认是否同一 namespace 与同一 cluster
- 页面 403 时确认 token 与权限

## 产品改版后如何更新自动化

- 入口路由变化时同步本文件与 pages 下的页面对象
