# 能力矩阵台账复核（2026-11-15）

本轮不再挑新页面，而是**把台账与代码对齐**：矩阵里若干行仍写着「待补」，实际已在代码与用例中交付。台账是「逐页核实」的判据，判据失真会让后续每一轮都做错事，因此单独成篇。

## 复核方法

1. 逐条读矩阵 §1 的 R 项与 §0 检查项；
2. 对每个「待补/待复核」到代码里找实现（`grep` 组件、句柄、api-client 函数）；
3. 找到实现后跑对应用例确认行为，再改台账并写上证据（文件 + 用例 + 提交）。

## 本轮纠正的行

| 行 | 原记录 | 复核结论 | 证据 |
| --- | --- | --- | --- |
| R-24 管理员重置密码 | 待补（并登记「不迁移」，需复核） | **已交付** | `pages/platform/PlatformListPage.tsx` 行操作 `resetPassword` + `UserDetailPage` 内改密；`api-client` 的 `useResetUserPassword`；用例 `ACCESS_CONTROL-USERS-*`（8 passed） |
| R-24 登录历史分页 | 待补 | **已交付** | `pages/platform/LoginHistoryPanel.tsx`：`page/limit` + `total` 分页（`user-detail:login-total`） |
| R-24 批量启停 | 已交付（`48cad6d66`） | 保持 | `users:bulk-enable` / `users:bulk-disable` |
| R-24 `presetUsers` 保护 | 待补 | **已交付** | `api-client` 的 `PRESET_PLATFORM_USERS` + `isProtectedPlatformUser`；列表 `isRowSelectable`、行操作禁用、详情隐藏编辑 |
| R-26 无刷新按钮 | 已交付（本会话 12 批） | 保持 | 全仓审计：所有带列表页面都有刷新入口（2 处脚本误报已核实） |
| R-28 空态无出口 | 已交付 | 保持 | `ResourceList` 在存在 `onRefresh`/搜索时渲染 `empty-state:clear` / `empty-state:refresh` |
| R-21 白名单新建向导 | 已交付（`803afbf62`） | 保持 | `NetworkPolicyDialog` 多规则/三类对端/端口 + `networkPolicyManifest` 单测 9 条 |

## 仍然待补的三项（附真实阻塞）

| 行 | 状态 | 阻塞与证据 |
| --- | --- | --- |
| R-12 平台角色的多集群切换 | **受阻（非页面问题）** | 页面读 `/apis/rbac.authorization.k8s.io/v1/clusterroles`（核心组，经 BFF 代理到单一上游）。实测集群感知的 kapis 路径 `/kapis/resources.kubesphere.io/v1alpha3/clusters/host/clusterroles` 返回 **404**，非集群路径 200。因此「切换集群」需要 BFF 侧按集群路由，而不是改页面 |
| R-27 实时刷新 | 未开始 | 需要 WebSocket/watch 通道；当前全部页面是「主动刷新」语义（已交付）。设计需先定通道与断线策略 |
| R-29 集群物理资源 14 类指标 | 部分 | 日志/审计页已有计数条与分布图；集群物理资源的 14 类指标仍缺，需要逐项核对指标名与聚合口径 |

## 复核后的计数

- 「已迁移」页面族与原子能力不变（90 项页面族登记）；
- 本轮**不改分子分母**，只把 4 个原子能力从「待补」移入「已交付」，并把 R-12 从「待补」改判为「受阻（BFF）」；
- 剩余真正待补：**R-12（受阻）、R-27、R-29**。
