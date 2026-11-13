# TC-FULL-KUBE-FRONTEND-MONITORING-01 监控告警 · 两个页签切换不刷新

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-MONITORING-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `monitoring` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alerts`
- **需求**: `prd/kube-frontend/monitoring/_index.md`

## 产品功能

['告', '警', '消', '息', '与', '告', '警', '策', '略', '在', '同', '一', '个', '功', '能', '区', '，', '切', '换', '是', '客', '户', '端', '跳', '转', '。']

### 关联需求

- `prd/kube-frontend/monitoring/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/_index.md`](../../../../prd/kube-frontend/monitoring/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-MONITORING-01** — 已知已登录且有项目权限，当在两个页签之间切换，则每次都显示对应列表或空态，页签高亮跟随，且切换不产生文档请求。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/_index.md`](../../../../design/kube-frontend/monitoring/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/_index.md`](../../../../prd/kube-frontend/monitoring/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在告警与策略之间切换而不离开当前项目 (Priority: P1)

作为 **项目运维**，我希望 **用页签切换两张表**，以便 **不必回侧栏**。

**Independent Test**：从告警消息切到告警策略，核对页签高亮与工作区栏项目不变，且没有整页刷新。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开告警消息页
2. 切到告警策略页签
3. 再切回告警消息
4. 统计切换期间的文档请求

## 期望结果

- 两个页面各自出现列表或空态
- 切换后对应页签高亮
- 切换期间文档请求为 0

## 失败排查

- 出现文档请求说明页签退化成整页跳转

## 产品改版后如何更新自动化

- 页签结构变化时改 pages/monitoring.py
