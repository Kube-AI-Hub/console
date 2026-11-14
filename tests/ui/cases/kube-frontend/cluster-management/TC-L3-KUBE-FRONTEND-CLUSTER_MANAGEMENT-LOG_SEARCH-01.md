# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01 容器日志查询 · 检索与分页

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `log-search`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/logs`
- **需求**: `prd/kube-frontend/cluster-management/log-search.md`

## 产品功能

集群日志检索：时间窗口 + 项目/容器组/容器/关键字过滤 + 服务端分页。

### 关联需求

- `prd/kube-frontend/cluster-management/log-search.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/log-search.md`](../../../../prd/kube-frontend/cluster-management/log-search.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01** — 已知集群有日志，当打开容器日志查询页，则按时间倒序显示「时间 + 项目/容器组/容器 + 日志行」；首页条数等于 `min(50, 接口 total)`；项目过滤只留该项目的日志行；关键字过滤通过 `log_query` 下发并使结果减少；底部显示总数与页码，翻页取 `from/size` 的下一段。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/log-search.md`](../../../../design/kube-frontend/cluster-management/log-search.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/log-search.md`](../../../../prd/kube-frontend/cluster-management/log-search.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 出问题时先看日志 (Priority: P1)

作为 **运维/项目成员**，我希望 **按项目与关键字检索最近的日志**，以便 **不必逐个容器登进去翻**。

**Independent Test**：选一个项目，读接口返回总数与首页条数，页面行数与之对应；输入关键字后结果收窄。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群日志组件在采集（ES 索引有数据）

## 测试步骤

1. 用 API 读最近 1 小时日志的 total 与首页条数
2. 打开容器日志查询页
3. 核对首页行数、总数显示
4. 按项目过滤后核对只剩该项目的日志

## 期望结果

- 首页行数等于 min(50, total)
- 底部显示总数与页码
- 项目过滤后行内只出现该项目的命名空间

## 失败排查

- 行数为 0：时间参数传了毫秒（接口要秒）
- 过滤无效：用了单数键（namespace/pod），应使用 namespaces/pods
- 总数不符：断言了会随时间增长的总数（应只比首页条数）

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterLogsPage.tsx
