# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-08 集群概览 · 自动刷新与可见性暂停

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

一个30秒协调器，可暂停并在隐藏时停止，不伪造实时数据。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-09** — 默认30秒协调资源、选中趋势、排行与Kubernetes状态刷新，可暂停/恢复；隐藏时暂停，可见恢复后刷新一次。有请求未完成不叠加轮询，离开或切集群清理计时器/观察器。暂停/继续与刷新采用简短图标文字次要按钮，图标随运行状态切换，完整自动刷新语义和周期通过可访问名称及提示保留；kubectl为强调主按钮，不显示最近刷新时间。失败明确说明，保留旧值时有旧值标识，手动刷新保留原全部查询范围并显示等待状态。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/overview.md`](../../../../design/kube-frontend/cluster-management/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 优先定位资源压力并查看变化 (Priority: P1)

作为 **集群运维人员**，我希望 **先看资源总量/用量和节点排行，并切换资源趋势**，以便 **快速定位压力与异常节点**。

**Independent Test**：资源和排行先于身份信息；切换资源与1h/6h/24h，趋势与同次历史响应对账；默认30秒更新，可暂停，隐藏页面不继续轮询。

## 前置与配置

- 已登录；使用浏览器受控时钟和明确模拟的指标响应

## 测试步骤

1. 核对暂停/继续与刷新使用图标及短文字次要按钮，kubectl主按钮更突出，没有最近刷新时间
2. 首次读取完成后推进30秒，核对新请求
3. 暂停后核对图标切换为继续并推进时间，核对没有额外请求
4. 恢复，隐藏页面后推进时间，核对停止轮询
5. 恢复可见，核对刷新一次及手动刷新
6. 返回失败并核对旧值标识，保留原值不当成最新状态

## 期望结果

- 轮询可控且隐藏暂停，数据请求不因装饰动画增加
- 刷新控件层次清晰、状态可读，失败不填0，不把旧值误报为实时

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
