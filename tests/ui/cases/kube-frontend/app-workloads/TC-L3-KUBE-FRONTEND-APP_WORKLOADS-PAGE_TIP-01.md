# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01 列表页头提示 · 展示、关闭与按页持久化

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `page-tip`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/page-tip.md`

## 产品功能

项目作用域列表页在表格上方显示一条可关闭的说明（资源是什么、常见误区、可选文档链接）；关闭状态按页面 key 存 localStorage，刷新后不再出现；配置字典、保密字典、服务账户、部署、容器组各有与本资源语义一致的文案。

### 关联需求

- `prd/kube-frontend/app-workloads/page-tip.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/page-tip.md`](../../../../prd/kube-frontend/app-workloads/page-tip.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01** — 已知打开部署列表页，则表格上方显示 data-ai-id=page-tip 的说明条，文案包含部署与滚动更新的具体说明，并带 data-ai-id=page-tip:link 的文档链接；当点 data-ai-id=page-tip:close 关闭，则说明条消失且 localStorage 记录该页已关闭，刷新页面后仍不出现；已知打开配置字典、保密字典、服务账户、容器组列表页，则各页显示与本资源语义一致的提示（保密字典提示 base64 存储不等于加密），且关闭部署页的提示不影响这些页。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/page-tip.md`](../../../../design/kube-frontend/app-workloads/page-tip.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/page-tip.md`](../../../../prd/kube-frontend/app-workloads/page-tip.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在列表页头读到「这个资源是什么、要注意什么」 (Priority: P1)

作为 **项目运维**，我希望 **打开列表页时在表格上方看到一条具体、可关闭的说明**，以便 **不必先点进详情或翻文档才知道最容易出错的地方**。

**Independent Test**：打开部署列表，页头出现部署提示；关闭后刷新仍不出现；打开保密字典列表，看到该页自己的提示（base64 ≠ 加密）。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间（部署列表可达）
- 用例先清掉部署页的关闭记录，保证提示初始可见

## 测试步骤

1. 打开部署列表，读取表格上方的 page-tip 说明条与文档链接
2. 点 page-tip:close 关闭，读取 localStorage 的关闭记录
3. 刷新页面，确认提示不再出现
4. 依次打开配置字典、保密字典、服务账户、容器组列表，读取各页 page-tip 文案

## 期望结果

- 部署页出现 page-tip，文案含「部署」与「滚动更新」，文档链接指向 kubernetes.io
- 关闭后 page-tip 消失，localStorage 键 kube-frontend.page-tip.dismissed.deployments 为 '1'
- 刷新后 page-tip 仍不出现
- 配置字典/保密字典/服务账户/容器组页都出现各自 page-tip，且保密字典文案含 base64、配置字典含明文、服务账户含令牌、容器组含重建
- 关闭部署页提示不影响其它页面的提示（各页 pageKey 独立）

## 失败排查

- 提示不出现：检查该页是否挂载 PageTip，以及 localStorage 是否残留关闭记录
- 刷新后又出现：关闭时没有写入 localStorage，或组件每次 render 重新读取了存储
- 关闭一个页面后其它页面也消失：pageKey 被写成同一个值

## 产品改版后如何更新自动化

- 文案变化时改 locale 的 pageTip.* 键
- 句柄变化时改 PageTip 的 data-ai-id 与用例里的定位
