# 服务账户 · 移动端适配（L3）

## 概述

375px 宽视口下，列表折叠角色、保密字典与创建时间列，只保留名称；详情页每个令牌块纵向堆叠，kubeconfig 预览可横向滚动。

## 用户故事

### US1 - 作为在手机上检查权限的用户，看到账户列表并打开详情

**Independent Test**：375×667 视口打开列表，无横向滚动；点名称进入详情，能看到 kubeconfig 预览。

## 验收场景

- **AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-MOBILE-01** — Given 375px 宽视口打开服务账户列表与详情，When 等待加载完成，Then 列表页 `scrollWidth` 不超过视口、导航收进抽屉、触控目标不小于 44px，只显示名称列；详情页属性区单列、kubeconfig 预览可滚动且不撑破页面。

## 设计目标

- 手机上最主要的任务是「确认权限」与「复制 kubeconfig」，因此详情页的可读性比列表的列更优先。

## 约束与边界

- 断点：`role`、`secrets` → `lg` 以下隐藏；`createTime` → `md` 以下隐藏；`project` → `xl` 以下隐藏。
- kubeconfig 预览 `overflow: auto` 且 `max-height` 限制，避免长文档把页面撑高。

## UI 交互设计

- 复制与下载按钮在窄屏下换行到标题下方，仍满足 44px 触控高度。

## 文案与校验

- 同桌面视口。

## 边界情况

- 多个令牌时每个块独立堆叠，页面上没有横向滚动容器嵌套。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01** — 375px 下列表与详情都不得出现页面级横向滚动。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01** — `scrollWidth <= innerWidth`，kubeconfig 文本可读。

## 明确不做

- 不做专用的移动端详情布局。

## 假设

- 浏览器支持 `dvh`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01`
