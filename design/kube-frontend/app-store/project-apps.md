# 项目内应用（应用实例）· 技术方案

> 关联需求：prd/kube-frontend/app-store/project-apps.md。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01`
- `AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02`
- `AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03`

## 设计

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01 — 与工作空间「已安装应用」共用一个列表组件

旧 console 有两个视图看同一批 release：项目内的「应用」（可安装/删除）和企业空间的「应用实例」（只读汇总）。
新 UI 第一版只交付了企业空间视图。给项目页再写一份列表会让列、状态映射、卸载语义各写一次并开始漂移，所以
`InstalledAppsPage` 增加 `project`/`cluster` 两个可选属性：给了 project 就改读项目集合、改标题/说明/详情链接、
并打开安装与卸载；不给就是原来的工作空间只读视图。被否方案：新建 `ProjectAppsPage` 复制 200 行——两个视图的列已经
一致，复制只会让下一次改列漏掉一边。

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02 — 安装弹窗接收「已确定的目标」

`AppInstallDialog` 原本从商店详情打开，因此自带 工作空间/项目 两个选择器。项目页打开的安装流程里这两个值已经确定，
再让用户选一次是多余且容易选错（装到别的项目）。因此弹窗新增 `lockedWorkspace`/`lockedProject`：两者存在时预填并
禁用对应的下拉，同时跳过「自动选第一个」的副作用；`onInstalled` 回调让调用方刷新自己的列表。被否方案：项目页另写
一个只有版本/values 的简化向导——values 编辑与校验逻辑会立刻分叉（`conf` 必须是 YAML 字符串这类坑会各踩一次）。

### DEC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03 — 应用选择放在项目页，而不是跳到商店

旧 console 的「创建」是选模板后安装。让用户跳到商店再回来会丢失项目上下文（商店页不知道来源项目）。
因此项目页内先弹一个可按名称搜索的商店应用列表（`/kapis/openpitrix.io/v1/apps`），选中后再把 appId/名称/版本交给
锁定了目标的安装弹窗。选择器只承担「挑哪一个」，版本与 values 仍在安装弹窗里完成，避免第二个配置界面。

## 契约与不变量

- **CON-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 项目集合：`GET /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications?limit=-1`，
  返回 `{items, total_count}`，每项形状与工作空间汇总一致（`cluster.cluster_id`、`app{name,app_id}`、`version{name,version_id}`、`status`、`create_time`）。
- **CON-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — 安装：`POST` 同一集合，body `{app_id, version_id, name, description?, conf}`；`conf` 必须是 **YAML 字符串**（对象会被服务端以 unmarshal 错误拒绝）。
- **CON-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 卸载：`DELETE …/namespaces/<ns>/applications/<cluster_id>`，必须是 `rls-…` 对象 id；按 release 名删除返回 200 但不生效。

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 列表只展示当前项目集合返回的行；不把工作空间汇总在客户端过滤后冒充项目集合（total 会与服务器不一致）。
- **INV-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — 锁定目标时安装请求的工作空间/项目必须等于页面上下文，不得被弹窗自动选择改写。
- **INV-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 页面不渲染分页器：项目集合一次返回全量，搜索在页内完成并在说明里写明。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01** — 卸载是异步的：DELETE 返回 200 后汇总/项目集合可能仍在数秒内返回该 release。用例必须轮询到消失（≤90s），不能即时断言；finally 清理同样要「仍在则按 cluster_id 再删并轮询」。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — `InputSearch` 的 `onChange/onSearch` 回调参数是字符串（不是事件）；写成 `event.target.value` 会在 tsc 报错、运行时静默拿到 undefined。
- **GOT-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03** — 项目集合的 `items` 可能含刚创建、`status=creating` 的 release；状态列必须如实显示 creating 而不是当成失败。

## 测试与可观测

- 列表/安装/卸载三条用例（`TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01..03`）在 B200 本地全栈串行跑，写用例自建唯一 release 并在 finally 清理。
- 句柄：`installed-apps:surface`、`installed-apps:table`、`installed-apps:install`、`installed-apps:pick`、`installed-apps:pick-search`、`installed-apps:pick-app:<appId>`、`installed-apps:uninstall`、`installed-apps:uninstall:confirm`。
