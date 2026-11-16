# 商店管理（L3）

[子模块需求](./_index.md)

## 概述

`/kube-frontend/apps-manage` 三个页签：应用（商店里已发布的应用）、分类、审核。

## 用户故事

### US1 - 管理商店里有什么 (Priority: P2)

作为 **平台管理员**，我希望 **看到商店里已发布的应用、分类与审核记录**，以便 **知道商店的状态与管理入口在哪**。

**Independent Test**：打开 `/kube-frontend/apps-manage`，默认落在「应用」页签；三个页签都能切换且各自显示内容或空态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01** — 当打开 `/kube-frontend/apps-manage`，则重定向到 `/store` 并显示「应用/分类/审核」三个页签。
- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02** — 当切到「分类」，则列出商店分类及其应用数。
- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-04** — 已知三个视图（应用/分类/审核）都是多列表格，当点工具栏的「显示列」，则只列出可隐藏列（名称不可隐藏）；取消勾选后该表头立即消失、选择按视图分别保存（`kube-frontend.columns.store-manage:{apps,categories,reviews}`）、刷新页面仍保持，「重置」恢复全部列；三个视图各自独立，隐藏「应用」的一列不影响「分类」。
- **AC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-03** — 当切到「审核」，则列出审核记录；没有记录时说明需要先发布应用。

## 设计目标

先把"商店里有什么"变得可见；写操作（建分类、通过审核）明确标注未做。

## 约束与边界

- 本轮只读：创建分类、通过/驳回审核是 openpitrix 写操作，当前商店无应用与审核记录，无法验证，登记为缺口而不是猜实现。

## UI 交互设计

顶部区域页签（应用 / 分类 / 审核），右上「刷新」；三个表格各自有空态。

## 文案与校验

空态文案区分「还没有应用」与「没有待审核」。

## 边界情况

- 审核记录为空但分类存在：只影响审核页签，不连累其它页签。
- 刷新按钮作用于当前页签。

## 明确不做

- 创建/编辑/删除分类。
- 通过/驳回审核。
- 应用的下架。

## 假设

- openpitrix 的 `apps`、`categories`、`reviews` 接口可读。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02`
- `TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01** — 三个页签与默认重定向。
- **FR-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02** — 各页签的列表与空态。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01** — 用例跑通三个页签与默认重定向。
