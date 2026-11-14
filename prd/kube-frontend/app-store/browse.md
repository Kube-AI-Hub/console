# 商店浏览（L3）

[子模块需求](./_index.md)

## 概述

应用商店首页 `/kube-frontend/apps`：左侧分类栏，右侧应用卡片；无应用时给出空态说明。

## 用户故事

### US1 - 找到想安装的应用 (Priority: P1)

作为 **平台用户**，我希望 **按分类浏览商店里的应用**，以便 **找到可安装的模板并知道商店是否配置了仓库**。

**Independent Test**：打开应用商店，能看到分类栏与「全部分类」；点击某个分类后列表按其过滤；商店为空时显示说明而不是空白。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01** — 当打开 `/kube-frontend/apps`，则显示分类栏（含分类的应用数）与应用区。
- **AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-02** — 当商店里没有应用，则显示空态：应用来自应用仓库，仓库为空商店就为空。
- **AC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-03** — 当点击「商店管理」链接，则进入 `/kube-frontend/apps-manage`。

## 设计目标

消除顶栏「应用商店」死链，并让"商店为空"与"加载失败"可区分。

## 约束与边界

- 只读浏览：安装（deploy）是独立流程，本轮未做。
- 分类用 `category_id` 过滤，读取一次性全量分类。

## UI 交互设计

左栏分类（含数量），右侧卡片网格（名称、状态徽标、描述两行截断）。

## 文案与校验

空态区分为「无应用」与「读取失败」。

## 边界情况

- 分类 `locale` 字段是 JSON 字符串：按 `zh-CN` → `zh` → `en` → 第一个可用语言取值，解析失败时退回原始 name。
- 分类数量为 0：仍显示「全部分类」。

## 明确不做

- 应用详情页与应用安装（deploy）。
- 应用评分与评论提交。

## 假设

- openpitrix 接口 `/kapis/openpitrix.io/v1/{apps,categories}` 可用。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01** — 分类栏 + 应用区，按分类过滤。
- **FR-L3-KUBE-FRONTEND-APP_STORE-BROWSE-02** — 空态与失败态可区分。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01** — 用例覆盖分类栏、空态与商店管理跳转。
