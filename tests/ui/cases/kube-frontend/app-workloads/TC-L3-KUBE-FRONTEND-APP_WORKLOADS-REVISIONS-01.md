# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01 部署详情 · 版本历史与回滚

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `revisions`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/revisions.md`

## 产品功能

部署详情列出各版本（版本号、镜像、副本、时间），当前版本带标记且不可回滚；回滚把服务端模板恢复为该版本的镜像。

### 关联需求

- `prd/kube-frontend/app-workloads/revisions.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/revisions.md`](../../../../prd/kube-frontend/app-workloads/revisions.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01** — 已知一个部署有三次改动形成的三个版本，当打开详情，则版本表按版本号降序、只有最新版本带「当前」标记且它没有回滚按钮；当对版本 1 回滚并确认，则容器镜像恢复为版本 1 的镜像。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/revisions.md`](../../../../design/kube-frontend/app-workloads/revisions.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/revisions.md`](../../../../prd/kube-frontend/app-workloads/revisions.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把部署退回上一个可用版本 (Priority: P1)

作为 **应用运维**，我希望 **看到历史版本并一键回退**，以便 **在发布出问题时尽快恢复**。

**Independent Test**：打开一个有多次改动的部署详情，核对版本表与回滚结果。

## 前置与配置

- 由夹具创建一个部署并依次改两次镜像，形成三个版本，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该部署详情
2. 读取版本表
3. 对版本 1 点「回滚」并确认
4. 用 API 读取容器镜像

## 期望结果

- 版本表按版本号降序，最新版本带「当前」标记
- 非当前版本各有回滚按钮
- 回滚后镜像恢复为版本 1 的镜像

## 失败排查

- 表不出现说明 revisions 查询未启用（仅 deployments）或没有 ReplicaSet
- 回滚无效说明模板 patch 路径不对（应为 spec.template）

## 产品改版后如何更新自动化

- 版本字段变化时改 api-client 的 toWorkloadRevision
