# TC-CORE-CONSOLE_CORE-01 控制台基础 · 详情页入口

- **用例 ID**: `TC-CORE-CONSOLE_CORE-01`
- **级别**: L1  **套件**: `core`
- **模块**: `console-core` / `flow` `page`
- **入口**: `{BASE_URL}/clusters/default/projects/agent-platform/pods`
- **需求**: `prd/console-core/_index.md`

## 产品功能

任意资源详情入口都能渲染出侧栏与页签，不停在加载中，也不出现未翻译 key。

### 关联需求

- `prd/console-core/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/console-core/_index.md`](../../../../prd/console-core/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-CORE-CONSOLE_CORE-01** — Given 已登录且已选中某个集群，When 打开任意资源详情页的入口路由，Then 页面主区渲染出侧栏与页签，不出现未翻译的 i18n key，也不出现「加载中」常驻。

### 关联设计

- 技术方案 [`design/console-core/_index.md`](../../../../design/console-core/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/console-core/_index.md`](../../../../prd/console-core/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，从菜单点进一条已被删除的记录时，看到中文提示并被送回列表

作为 **集群运维**，我希望 **打开一个已删除资源的详情链接时看到一句能看懂的中文提示，并自动回到它所属的列表页**，以便 **不用手动删地址栏、也不用刷新猜自己是不是点错了**。

**Independent Test**：打开 `/clusters/default/projects/agent-platform/pods/agent-platform-web-not-exist/resource-status`，页面在 3 秒内跳到 `/clusters/default/projects/agent-platform/pods`，右上角提示为中文，列表可见。

## 前置与配置

- 已登录，且在 default 集群
- agent-platform 项目下至少有一个 Pod

## 测试步骤

1. 打开 {BASE_URL}/clusters/default/projects/agent-platform/pods
2. 取第一行的 Pod 名称，打开它的 /resource-status
3. 等待页面稳定，读取侧栏名称与页签

## 期望结果

- 侧栏名称等于列表里的 Pod 名称
- 资源状态页签为选中态，主区有内容
- 页面不出现形如 FOO_BAR 的未翻译 key

## 失败排查

- 一直转圈时先看详情接口是否 404（该用例要求对象真实存在）

## 产品改版后如何更新自动化

- 页签标题变化时改 pages/resource_detail.py 的 TAB_TITLES
