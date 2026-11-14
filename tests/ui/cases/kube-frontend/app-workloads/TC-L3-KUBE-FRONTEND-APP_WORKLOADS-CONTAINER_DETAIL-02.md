# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02 容器详情 · 日志

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/public/clusters/host/projects/kubesphere-system/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

独立近全屏日志弹窗展示最近 1 小时历史日志，可按关键字查询并保留格式。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02** — 点「打开日志控制台」在近全屏独立弹窗显示最近 1 小时的容器日志（时间 + 内容，最多 200 行）；提交关键字通过 log_query 收窄结果；无日志显示空态，保留 ANSI 格式。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

## 前置与配置

- 已登录
- 集群日志组件在采集（ES 索引有数据），且有正在输出的容器

## 测试步骤

1. 用 API 找一个「容器组存在且有日志」的对象
2. 打开该容器组该容器的详情页
3. 点「打开日志控制台」，核对弹窗内真实日志内容非空
4. 提交唯一无匹配关键字，核对空态；清空并重新查询后恢复内容

## 期望结果

- 日志弹窗存在并显示时间与内容，不将 ANSI 控制码显示为普通文本

## 失败排查

- 区块缺失：页面仍是旧包（改完要 vite build）
- 空态但接口有数据：过滤键用了单数（pod/container），应为 pods/containers
- 时间参数毫秒：接口要秒

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py 与 ContainerDetailPage.tsx
