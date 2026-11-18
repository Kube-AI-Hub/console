# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03 容器组详情 · 调度信息的 GPU 分配区块

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail-tabs`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/detail-tabs.md`

## 产品功能

注解里含 GPU 分配时「调度信息」显示 GPU 分配区块，每设备一行、uuid 是到该设备状态页的链接，有值时显示厂商/显存/算力；注解里没有 GPU 分配时不显示该区块。

### 关联需求

- `prd/kube-frontend/app-workloads/detail-tabs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03** — 已知容器组注解里含 GPU 分配，当打开「调度信息」页签，则显示 GPU 分配区块，每个设备一行：设备 uuid 是链接、指向该设备的 GPU 详情页（集群 GPU 列表的单卡页），并在有值时显示厂商、显存、算力百分比；注解里没有 GPU 分配时不显示该区块。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail-tabs.md`](../../../../design/kube-frontend/app-workloads/detail-tabs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 按页签查看详情且切换不重新加载 (Priority: P1)

作为 **项目运维**，我希望 **详情页把概览、关联容器组、修订版本、事件和元数据分到页签里，并默认停在概览**，以便 **不必在一条长页里滚动，切换页签时也不用等数据重新请求**。

**Independent Test**：打开一个部署详情，核对五个页签并逐个切换；再打开一个容器组详情，核对四个页签并从「容器」进入容器详情。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建一个带 kubesphere.io/gpu-devices-allocated 注解的容器组（值形如 uuid,type,mem,core），再建一个不带该注解的容器组；用例结束后无条件删除

## 测试步骤

1. 打开带注解的容器组详情，点「调度信息」
2. 读 pods-detail:schedule-gpu 区块、每行 uuid 链接的文本与 href
3. 核对厂商、显存 MiB、算力百分比与该注解逐项一致
4. 打开不带注解的容器组详情 → 调度信息，确认没有 pods-detail:schedule-gpu

## 期望结果

- 有注解时出现 GPU 分配区块，每个设备一行
- 每行的 uuid 是链接，href 指向该集群该设备的 GPU 状态页（/clusters/<cluster>/gpus/<uuid>），链接文本是注解里的 uuid
- 行内显示厂商、显存 MiB、算力百分比（注解里为 0 的那一项不显示）
- 注解里没有 GPU 分配时不渲染该区块（不是空区块）

## 失败排查

- 区块不出现：解析只认固定键名，没按「键名包含 devices-allocated」识别
- 链接 404：用了带 MIG 后缀的 uuid，物理设备要剥掉 [1-1]
- 无注解也有区块：可见性没按注解数量判断

## 产品改版后如何更新自动化

- 句柄 pods-detail:schedule-gpu 与 pods-detail:gpu:<uuid>；解析见 api-client 的 parseGpuAllocations
