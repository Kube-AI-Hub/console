# 资源详情页 · 技术方案（L2）

[上级模块技术方案](../_index.md)

## 概述

详情页骨架 = 左栏 `BaseInfo` + 右栏页签路由。请求由各详情页的 `fetchData` 发起，落到自己的 store；骨架只关心 store 上的公共状态（`isLoading`、`detail`、`notFound`）与页面传入的 `breadcrumbs`。

## 关联需求

- `AC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01`
- `AC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02`

## 设计目标与非目标

- **目标**：骨架对「不存在」一处实现、所有资源共用；回退目标取页面自己声明的列表入口；页签切换不受影响。
- **非目标**：不改页签内容；不做页签级 404 回退；不做跨资源导航。

## 关键约束

- 骨架不直接发请求，只读 store。任何「在骨架里再请求一次确认」的方案都会让不存在的页面多打一次 API。
- 骨架在 `notFound` 为真时不再渲染页签，避免子路由对已删对象继续发请求。
- 回退发生在 `replace` 之后由路由驱动，骨架不做 `setState` 跳转。

## 页面与技术结构

| 组件 / 模块 | 路径 | 职责 | 不做什么 |
| --- | --- | --- | --- |
| 骨架 | `src/core/containers/Base/Detail/index.jsx` | 渲染左栏 + 页签；`notFound` 时回退 | 不解析资源字段 |
| 项目骨架 | `src/pages/projects/containers/Base/Detail/index.jsx` | 项目作用域的权限 | 不改失败路径 |
| 集群骨架 | `src/pages/clusters/containers/Base/Detail/index.jsx` | 集群作用域的权限 | 同上 |
| 详情页 | `src/pages/**/Detail/index.jsx` | 提供 `breadcrumbs` 与 store | 不各自实现回退 |
| 状态 | `src/stores/base.js` | `notFound` / `isLoading` | 不决定回退目标 |

## 状态与数据归属

| 状态 | 落在哪 | 刷新后还在吗 |
| --- | --- | --- |
| 当前页签 | 地址栏 | 在 |
| `detail` | store 实例 | 不在（重新请求） |
| `notFound` | store 实例 | 不在（回退后页面已卸载） |
| 提示去重时间戳 | 模块级 | 不在（刷新即清空） |

## 关键契约与依赖

| 契约 / 依赖 | 形式 | 风险点 |
| --- | --- | --- |
| `breadcrumbs[0].url` | 组件 props | 某些页面用 `pathToRegexp.compile` 占位符（如 `:cluster`），不 compile 会跳到字面量地址 |
| `store.notFound` | mobx observable | 子类重写 `fetchDetail` 且不设置它时，回退不生效 |
| `routing.replace` | mobx-react-router | 传字符串路径即可；传对象要带 `pathname` |

## 不变量

- **INV-L2-CONSOLE-CORE-RESOURCE_DETAIL-01**：`notFound` 为真时，骨架不渲染页签内容。
- **INV-L2-CONSOLE-CORE-RESOURCE_DETAIL-02**：回退地址必须能在路由表中命中，且保留集群 / 命名空间参数。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L2-CONSOLE-CORE-RESOURCE_DETAIL-01** | 详情页的 `render()` 在 `isLoading && !detail.name` 时提前返回 Loading，`DetailPage` 压根没挂载 | 只在 `DetailPage` 里加逻辑等于没加 | `src/stores/base.js` 先把 `isLoading` 置 false |
| **GOT-L2-CONSOLE-CORE-RESOURCE_DETAIL-02** | 部分页面的 `breadcrumbs[0].url` 带 `:cluster` / `:namespace` 占位符 | 直接 `replace` 会跳到含冒号的非法路径 | `listUrlFor` 里用 `pathToRegexp.compile(url)(params)` |
| **GOT-L2-CONSOLE-CORE-RESOURCE_DETAIL-03** | `ContainerDetail` 的列表入口是「父 Pod 详情」，不是容器列表 | 回退到 Pod 详情后再次 404 会二次回退 | 由 Pod 详情自己的 store 处理；容器页只回退一层 |

## 测试与可观测

- **自动化**：L2 用例 `TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01` / `-02`；功能点用例见 [`not-found.md`](./not-found.md) 的「验收用例」。
- **手动验证**：真实 Pod 切三个页签；失效 Pod 链接观察地址栏。
- **日志 / 指标**：浏览器控制台无未捕获 rejection。

## 明确不做

- 不在骨架里做二次确认请求。
- 不为每种资源定制回退动画或倒计时。

## 后续改进

- 若页签数量增长，可把页签导航改为配置驱动，减少各 `routes.js` 重复。

## 功能点

- [资源不存在](./not-found.md)

## 验收用例

- L2 核心路径：`TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01`
- L2 异常态：`TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02`
