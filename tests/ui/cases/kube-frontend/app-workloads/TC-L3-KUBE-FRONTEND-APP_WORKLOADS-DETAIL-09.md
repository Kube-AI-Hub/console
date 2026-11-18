# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-09 定时任务详情 · 立即运行一次（复制 jobTemplate 创建任务）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/cronjobs`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

运行记录页签的「立即运行一次」按定时任务的 jobTemplate 创建一个任务（标签与模板一致、带手动触发注解），运行记录随后出现新行；没有创建任务权限时按钮禁用并说明原因。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-09** — 已知打开一个定时任务的运行记录页签，当点「立即运行一次」，则按该定时任务的 jobTemplate 创建一个任务（标签与模板一致、带手动触发注解），运行记录出现新行；当前账号没有创建任务的权限时按钮禁用并说明原因，不发请求。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 已登录，host 集群 default 项目，admin
- {'用例创建一个暂停的定时任务（suspend': 'true），这样运行记录只由「立即运行一次」产生'}
- 结束后删除定时任务与它创建的任务

## 测试步骤

1. 用 API 创建 suspend=true 的 CronJob（jobTemplate 带唯一标签）
2. 打开该定时任务详情，等运行记录就绪
3. 记录当前任务表行数（应为 0 或只有历史行）
4. 点「立即运行一次」（cronjobs-detail:run-now）
5. 轮询 kapis 的 jobs 集合，直到出现带 cronjob.kubernetes.io/instantiate=manual 注解且标签匹配的新任务
6. 等运行记录刷新，核对任务表出现该任务名行，且行数 +1

## 期望结果

- 新任务的标签等于 jobTemplate 的标签，注解含 instantiate=manual
- 运行记录出现新行，名称与 API 读到的一致
- 按钮在请求进行中禁用并显示「正在创建任务…」

## 失败排查

- 点了没反应：先看 SSAR（create jobs）是否 allowed=false；按钮禁用时会显示原因
- 任务创建了但表里没有：运行记录查询的标签是否与模板一致；ownerReferences 是否指向该定时任务

## 产品改版后如何更新自动化

- 按钮句柄 cronjobs-detail:run-now；行句柄 cronjobs-detail:run:<任务名>
