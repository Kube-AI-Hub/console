# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02 负载详情 · 返回列表保留页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

详情页的返回链接回到同一项目的部署列表，页签仍高亮部署，工作区栏不重建。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02** — 已知在详情页，当点返回链接，则回到同一项目的列表，页签仍高亮。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 直接打开该部署的详情
2. 点击返回链接
3. 读取 URL、当前页签与工作区栏项目

## 期望结果

- URL 回到 …/projects/default/deployments
- 部署页签 aria-current=page
- 工作区栏仍显示 default 项目

## 失败排查

- 返回后停在详情时看链接是否被普通点击拦截
- 页签不高亮时看 projectPageSegment 是否取到 deployments

## 产品改版后如何更新自动化

- 句柄变化时改 pages/app_workloads.py
