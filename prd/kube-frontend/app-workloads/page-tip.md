# 列表页头提示（L3）

[子模块需求](./_index.md)

## 概述

老 console 的每个列表页顶部有一条可关闭的 Banner：这个资源是什么、最容易踩的坑、文档链接。新 UI 只剩 title + 一行 description，能认出页面，却教不会读者「保密字典是 base64 而不是加密」这类必须说出来的事实。本功能点补一个统一的轻量组件 PageTip，并接入项目作用域列表页（配置字典、保密字典、服务账户、部署、容器组）。

## 用户故事

### US1 - 在列表页头读到「这个资源是什么、要注意什么」 (Priority: P1)

作为 **项目运维**，我希望 **打开列表页时在表格上方看到一条具体、可关闭的说明**，以便 **不必先点进详情或翻文档才知道最容易出错的地方**。

**Independent Test**：打开部署列表，页头出现部署提示；关闭后刷新仍不出现；打开保密字典列表，看到该页自己的提示（base64 ≠ 加密）。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01** — 已知打开部署列表页，则表格上方显示 data-ai-id=page-tip 的说明条，文案包含部署与滚动更新的具体说明，并带 data-ai-id=page-tip:link 的文档链接；当点 data-ai-id=page-tip:close 关闭，则说明条消失且 localStorage 记录该页已关闭，刷新页面后仍不出现；已知打开配置字典、保密字典、服务账户、容器组列表页，则各页显示与本资源语义一致的提示（保密字典提示 base64 存储不等于加密），且关闭部署页的提示不影响这些页。

## 设计目标

- 一行、轻量、不挡表格：不是 modal，也不是大卡片。
- 每页文案必须具体到该资源的常见误区，而不是复述 title/description。
- 关闭状态按页面 key 持久化，读者不需要每次关。
- 组件统一：颜色、图标、关闭交互、链接、data-ai-id 只实现一次。

## 约束与边界

- 关闭状态存 localStorage，键为 kube-frontend.page-tip.dismissed.<pageKey>；清浏览器数据后会重新出现。
- 只做项目作用域列表页的只读说明；不做多页引导、不做「不再提示此站」。
- 组件不引入新依赖，图标与按钮来自 @kube-ai-hub/ui（页面不出现裸 button）。
- 文档链接指向官方 Kubernetes 文档（稳定 URL），不在控制台内维护文档正文。

## UI 交互设计

说明条位于列表表格上方：左侧信息图标，中间一行文字（可含文档链接），右侧关闭按钮。

- data-ai-id：容器 page-tip，关闭按钮 page-tip:close，文档链接 page-tip:link。
- 关闭后立即消失，并写入 localStorage；同一页面刷新/重新进入不再渲染。
- 链接新标签页打开（target=_blank，rel=noreferrer）。
- 每页文案用 locale 键 pageTip.<pageKey>；关闭按钮 aria-label 用 pageTip.close，链接文案用 pageTip.docs。

## 文案与校验

- 配置字典：非敏感键值配置、明文存储；密码/令牌请用保密字典。
- 保密字典：base64 是编码不是加密，有命名空间读权限即可解码；用 RBAC 限制读取。
- 服务账户：给容器组内进程 API 身份，不是登录账号；令牌由 kubelet 挂载。
- 部署：通过副本集管理容器组并滚动更新；改镜像要改容器模板，而不是删单个容器组。
- 容器组：最小调度单元；删除由控制器重建而不是原地重启，排障先看事件再看日志。
- 链接文案：「查看文档」；关闭按钮 aria-label：「关闭提示」。

## 边界情况

- localStorage 不可用（隐私模式）：提示仍显示，关闭只对当前渲染生效，不报错。
- 同一页反复渲染：只读一次 localStorage，避免无关状态变化把已关闭的提示重新显示。
- 提示已在其他标签页关闭：本标签页下次加载时生效（不实时同步）。
- 链接点击不应触发关闭，关闭也不应跳转。
- 该页面无提示配置（例如其它资源列表）：不渲染任何占位。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01** — 提供统一 PageTip 组件：图标 + 文案 + 可选文档链接 + 可关闭，关闭持久化。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-02** — 接入配置字典、保密字典、服务账户、部署、容器组五个项目作用域列表页，每页文案具体。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-03** — 提示条暴露 page-tip / page-tip:close / page-tip:link 三个稳定句柄。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01** — 五个列表页首屏都能在表格上方看到对应提示。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-02** — 关闭后刷新不再出现，且不影响其他页面的提示。

## 明确不做

- 不做多步引导、tour 或帮助中心。
- 不做按用户/后端持久化的已读状态（只用浏览器 localStorage）。
- 不在提示里内嵌文档正文；链接到官方文档。
- 不覆盖集群作用域列表页与详情页（本轮只做项目作用域列表）。

## 假设

- 这五个列表页的表头与表格骨架保持不变，提示只是表格上方多一行。
- 官方 Kubernetes 文档 URL 长期稳定，可用作「查看文档」的目标。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01
