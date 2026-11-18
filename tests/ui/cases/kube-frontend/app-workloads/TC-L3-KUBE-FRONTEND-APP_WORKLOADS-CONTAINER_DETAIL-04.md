# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-04 容器详情 · 四页签与切换不重新取数

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

容器详情页签为 资源状态 / 监控 / 环境变量 / 日志，默认停在资源状态；切换页签只换面板，不重新请求容器组对象。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-04** — 已知一个容器详情，则页签为「资源状态 / 监控 / 环境变量 / 日志」，默认停在「资源状态」；切换页签不重新请求数据。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 项目里至少有一个带容器的容器组（用例按 API 挑一个容器，优先已调度的）

## 测试步骤

1. 打开该容器详情，等页面 ready
2. 读四个页签触发器的文案与顺序，读默认选中项与可见面板
3. 依次点「监控」「环境变量」「日志」，各读对应面板是否可见
4. 期间统计发往该容器组详情的请求次数

## 期望结果

- 页签依次为 资源状态、监控、环境变量、日志；默认「资源状态」为选中态（aria-selected=true）且其面板可见
- 点「监控」后监控面板出现；点「环境变量」后环境变量区块出现；点「日志」后日志区块出现
- 整个切换过程中，容器组详情接口只被请求一次（没有因为切页签重新取数）

## 失败排查

- 页签只有一项或没有：CONTAINER_TABS 未启用，页面仍是单列
- 切页签重新请求：查询被挪进了页签面板而不是页面顶层
- 默认不在资源状态：activeTab 初值不是 resources

## 产品改版后如何更新自动化

- 句柄 container-detail:tab-trigger:<resources|monitor|env|logs> 与 container-detail:tab:<同>；见 ContainerDetailPage.tsx 的 CONTAINER_TABS
