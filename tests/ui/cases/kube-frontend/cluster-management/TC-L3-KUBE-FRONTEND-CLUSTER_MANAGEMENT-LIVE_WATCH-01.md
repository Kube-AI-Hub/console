# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01 容器组列表实时刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `live-watch`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/pods`
- **需求**: `prd/kube-frontend/cluster-management/live-watch.md`

## 产品功能

容器组列表的「实时」开关：通过 kube watch 流感知变更并让列表查询失效重取。

### 关联需求

- `prd/kube-frontend/cluster-management/live-watch.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/live-watch.md`](../../../../prd/kube-frontend/cluster-management/live-watch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01** — 已知可访问集群 watch 接口，当在容器组列表打开「实时」开关，则开关进入按下状态、状态文本在长连接建立后变为「实时更新中」，且实时开启期间列表仍可正常翻页/改档位；关闭开关后状态文本消失。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/live-watch.md`](../../../../design/kube-frontend/cluster-management/live-watch.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/live-watch.md`](../../../../prd/kube-frontend/cluster-management/live-watch.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 排障时看到实时变化 (Priority: P2)

作为 **运维**，我希望 **容器组列表能自动更新**，以便 **在删除/重建容器组时不必反复点刷新**。

**Independent Test**：打开容器组列表并开启实时，状态显示「实时更新中」；关闭后状态消失。

## 前置与配置

- 已登录且对集群容器组有读取权限
- BFF 与 dev 静态代理均可透传并取消长连接

## 测试步骤

1. 打开集群级容器组列表
2. 点击「实时」开关
3. 观察状态文本，并在开启期间改一次分页档位
4. 再次点击关闭

## 期望结果

- 开关 aria-pressed 为 true，状态文本变为「实时更新中」
- 分页档位仍可用（长连接不饿死短请求）
- 关闭后开关回到 false、状态文本消失

## 失败排查

- 一直是「正在连接…」：连接建立后没有标记 live（应在 onOpen 标记，而不是等第一条事件）
- 状态为失败：watch 接口 403/不可用（环境问题）
- 页面卡住且 /api 全部超时：dev 静态代理的长连接与普通请求共用连接池，或中止时未 abort 上游

## 产品改版后如何更新自动化

- 选择器：cluster-pods:live / cluster-pods:live-state
