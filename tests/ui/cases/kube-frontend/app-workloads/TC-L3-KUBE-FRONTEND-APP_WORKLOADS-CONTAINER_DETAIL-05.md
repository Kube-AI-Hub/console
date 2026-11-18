# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-05 容器详情 · 镜像 ID

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

「资源状态」页签的属性含「镜像 ID」，值等于该容器 status.containerStatuses 的 imageID；容器未启动时显示「-」。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-05** — 已知容器已启动，当打开「资源状态」页签，则属性含「镜像 ID」，值等于该容器 status.containerStatuses 的 imageID；容器未启动时显示「-」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 用例按 API 挑一个已启动的容器（default 优先、否则 kubesphere-system），并另建一个调度不出去的容器组（容器未启动）；用例结束后删除自建对象

## 测试步骤

1. 打开已启动容器的详情，停在默认「资源状态」页签
2. 读 container-detail:image-id 的文本
3. 与该容器组对象里该容器的 status.containerStatuses[].imageID 逐字核对
4. 打开自建容器组里那个未启动的容器详情，读同一处

## 期望结果

- 属性里有「镜像 ID」，值与该容器 status.containerStatuses 的 imageID 完全一致（含 docker-pullable:// 前缀）
- 容器未启动（没有 containerStatuses 条目）时显示「-」，不是空串

## 失败排查

- 显示 - 但有 containerStatuses：读的是 spec.image 或没按容器名匹配 status
- 显示空串：空值没有走「缺值显示 -」的规则
- 值被截断：UI 截断了长 digest，应保留完整值（可悬停看全）

## 产品改版后如何更新自动化

- 句柄 container-detail:image-id（值元素）；字段来自 status.containerStatuses[].imageID
