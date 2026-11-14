# 列表页头提示（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/page-tip.md)

## 概述

新组件 components/resource/PageTip.tsx：一行说明条（信息图标 + 文案 + 可选文档链接 + 关闭按钮），关闭状态按 pageKey 存 localStorage。接入五个项目作用域列表页：配置字典、保密字典、服务账户、部署、容器组。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01

## 设计目标与非目标

目标：恢复老 console 列表页 Banner 的信息量（是什么、坑在哪、文档在哪），统一成一个组件；关闭状态按页持久化；句柄稳定可自动化。

非目标：多步引导、帮助中心、后端持久化已读、集群作用域页面。

## 关键约束

- 轻量：一行，不阻塞表格，不引入 modal/卡片。
- 页面禁止裸 button：关闭用 Button（@kube-ai-hub/ui），并带 actionProps('page-tip:close')。
- 关闭状态键：kube-frontend.page-tip.dismissed.<pageKey>；localStorage 读写失败要吞掉（隐私模式），不能因此让页面报错。
- 文案进 locale（pageTip.* 的 zh + en），组件里不写死中文。
- 说明条 id 必须是字面量 data-ai-id=page-tip（页面契约要求字面量句柄）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01 — 统一组件 + 每页一条具体文案，而不是各页自己拼一段说明

**为什么**：老 console 的 Banner 在每个列表页都出现，视觉与交互必须一致；如果每个页面各拼一段 p 标签，关闭逻辑、图标、间距、句柄会逐页漂移，最后又是八种「说明」。组件只接收 pageKey 与文案，样式与持久化只实现一次。

**被否方案**：直接用现有 ResourceList 的 description 字段承载全部说明。description 是标题下一行，无法承载文档链接与关闭交互，也没有「关闭后不再打扰」的语义。

**何时重新考虑**：说明条需要富文本/多段落时，再扩展为可折叠面板，但仍应保持单组件。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-02 — 关闭状态按页面 key 存 localStorage，而不是全局关闭

**为什么**：读者关掉「配置字典是明文」的提示，不代表他已经知道「保密字典是 base64」。按页 key 持久化让每页只关一次；用全局开关会让最需要提醒的页面永久沉默。localStorage 不需要后端迁移，刷新后仍在。

**被否方案**：sessionStorage。关掉后新开标签页又出现，等于没记住。
**被否方案**：后端用户偏好。为一行提示引入跨设备状态与写接口，成本与收益不匹配。

**何时重新考虑**：需要「所有提示都不再显示」的用户级偏好时，加全局开关，但仍保留按页粒度。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-03 — 只为「列表本身教不会」的事实写提示

**为什么**：提示如果只是复述 title/description（「这里是配置字典列表」），就是噪音。只写两类信息：资源是什么（一句话），以及最容易误解的一点（base64≠加密、删 Pod≠重启、改镜像=改模板）。因此五个必需页面各一条；没有具体误区的页面暂不添加。

**被否方案**：所有列表页都加通用说明。会迅速变成每页都一样的装饰，读者学会忽略它。

**何时重新考虑**：某个页面的支持问题集中在某个误区时，再为该页补一条具体文案。

## 系统现状

老 console 的每个列表页通过 Banner 组件展示资源说明与文档入口；新 UI 迁移后只剩 ResourceList 的 title + description，R10 缺口正是这块信息密度。页面结构不需要改，只在表格上方插入一行。

## 仓库落点

- apps/console-next/src/components/resource/PageTip.tsx
- 接入：pages/configmaps/ConfigMapsPage.tsx、pages/secrets/SecretsPage.tsx、pages/serviceaccounts/ServiceAccountsPage.tsx、pages/app-workloads/WorkloadListPage.tsx（deployments / pods）
- 文案：packages/locales/src/index.ts 的 pageTip.*

## 对外契约

- data-ai-id=page-tip：说明条容器；page-tip:close：关闭按钮；page-tip:link：文档链接（该页配置了 docHref 时才渲染）。
- 持久化键：kube-frontend.page-tip.dismissed.<pageKey>，值 '1' 表示已关闭；pageKey 分别为 configmaps / secrets / serviceaccounts / deployments / pods。
- 文档链接：Kubernetes 官方文档对应资源页。

## 不变量

- 关闭一个页面的提示不影响其它页面。
- 提示不遮挡/不替换表格；表格的 data-ai-id 与就绪状态不变。
- localStorage 不可用时不抛错，关闭仍对当前渲染生效。
- 提示组件不引入请求；纯前端状态。

## 已知坑

- 关闭状态在组件挂载时读一次；若在每次 render 里读，任何无关 state 变化都可能把刚关闭的提示重新显示。
- localStorage 在隐私模式可能抛异常，读写都要 try/catch。
- 组件返回 null 时不能违反 Hook 顺序：Hook 必须在提前 return 之前调用完。
- 页面里已有 ResourceList 的 title/description，提示不要重复它们的内容，否则等于两行同义文案。

## 测试与可观测

E2E：TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01。部署列表页断言提示出现、链接存在、点关闭后消失、刷新后仍消失（localStorage 键为 kube-frontend.page-tip.dismissed.deployments）；再逐页确认配置字典/保密字典/服务账户/容器组的提示存在且文案包含该页关键词。用例结束清理 localStorage 键，避免影响同会话其它用例。

## 后续改进

- 需要时把提示文案做成可配置（manifest/后端），但句柄与持久化语义不变。
- 「所有提示都不再显示」的用户级偏好。
- 把同样的说明条迁到集群作用域列表页。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01
