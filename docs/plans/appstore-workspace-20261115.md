# 企业空间应用页族（应用仓库 / 应用模板 / 已安装应用）迁移交付记录

> 单元：CHECK-06「新开启区域的深度能力」中的应用商店页族。日期 2026-11-15。
> 方法：docs/legacy-ui-migration-guide.md；模板：docs/plans/page-migration-template.md。
> 规格正文：prd|design/kube-frontend/app-store/{workspace-repos,workspace-apps,installed-apps,detail}.md。
> 本记录只证明下列范围；未执行的验证在 §6 逐项写明。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务 | 企业空间管理员：维护应用仓库 → 上传/发布应用模板 → 从商店安装应用到项目 → 回读已安装应用并卸载 |
| 旧入口/源码 | workspaces/containers/Repos（列表/添加/编辑/删除）、Repos/Detail（事件）、workspaces/containers/Apps（APP_TEMPLATE：上传模板/创建/版本管理/发布）、Apps/Detail/{VersionManage,AppInstances}、pages/apps/**（store 浏览、应用详情、AppDeploy 安装、StoreManage/Categories/Reviews） |
| 新入口/文件 | /kube-frontend/workspaces/$workspace/{repos,repos/$repoId,apps,apps/$appId,apps/instances}、/kube-frontend/apps、/kube-frontend/apps/$appId、/kube-frontend/apps-manage；pages/appstore/**；packages/api-client/src/appstore.ts |
| 环境/角色 | B200（本地全栈 BFF 8092 → ks-apiserver，静态站 5178），集群 host，账号 admin，企业空间 system-workspace / public |
| 视口/主题/语言 | 1280×900 全页 + 1024/1600 关键页；深色主题；中文为主、英文复核（kube-frontend-locale=en） |
| 子页面与状态 | 仓库列表/新增/编辑/删除/同步索引/详情（基本信息+事件）；应用模板列表/上传/详情（版本+实例+基本信息）/版本审核流转/删除版本/删除模板；已安装应用列表/详情 5 页签/卸载；商店浏览/详情/安装弹窗 values |
| 明确排除 | 见各 PRD「明确不做」：商店管理写操作（分类/审核/下架）、应用模板图标/截图/分类编辑、版本 YAML 编辑、values.schema 结构化表单（无样本）、安装协议弹窗、升级/回滚（无接口）、项目级「应用」页、watch 实时刷新 |
| 并行边界 | 不与并行线的 cluster/**、user-settings/about、cluster-gpu/**、package.json/yarn.lock 重叠；共享文件（tree.py、catalog、locales、api-client barrel、cases、_traceability）按生成器/局部 edit 合入 |

## 2. 旧能力与归宿（摘要，原子清单见 PRD AC）

| 旧能力 | 归宿 | 新 AC / 用例 |
| --- | --- | --- |
| 仓库列表（名称/地址/状态/创建时间）+ 空态 | 保留并扩展（新增创建者列、搜索、刷新、空态出口） | AC-…-WORKSPACE_REPOS-01；TC-…-WORKSPACE_REPOS-01 |
| 添加仓库（名称/URL/描述/凭证） | 补齐（协议 http/https/s3、同步周期 180s–86400s 校验、s3 凭证） | AC-…-WORKSPACE_REPOS-02 |
| 编辑仓库 | 补齐（PATCH 回读一致、非法同步周期本地拒绝） | AC-…-WORKSPACE_REPOS-03 |
| 删除仓库 | 保留 + 确认框 + 接口回读 | AC-…-WORKSPACE_REPOS-02 |
| 同步索引（老 console 行操作） | 补齐（POST action=index，失败如实提示） | AC-…-WORKSPACE_REPOS-04 |
| 仓库详情（老 Repos/Detail 事件页签） | 补齐（基本信息 + 事件页签 + 不存在时错误面板） | AC-…-WORKSPACE_REPOS-05 |
| 仓库写入口的权限门控 | 补齐（SSAR 拒绝时隐藏/禁用并说明；探测失败 fail-open） | AC-…-WORKSPACE_REPOS-06 |
| 中英文一致性 | 修复（原 zh 键内写英文导致中文界面出现 Add repository） | AC-…-WORKSPACE_REPOS-07 |
| 应用模板列表（名称/状态/版本/时间） | 保留并扩展（最新版本、版本类型、刷新、权限说明） | AC-…-WORKSPACE_APPS-01 |
| 上传模板（.tgz/.tar.gz ≤2MiB，validate→create） | 补齐 | AC-…-WORKSPACE_APPS-02 |
| 模板详情：版本页签 + 审核流转 | 补齐（draft→submit→submitted→cancel；passed→release；active→suspend/recover） | AC-…-WORKSPACE_APPS-03 |
| 模板详情：应用实例页签 | 补齐（按 release 关联） | AC-…-WORKSPACE_APPS-03 |
| 删除版本 / 删除模板（有版本时服务端拒绝） | 补齐（先删版本再删模板，确认按钮在版本数为 0 前禁用） | AC-…-WORKSPACE_APPS-04 |
| 已安装应用列表（跨项目汇总） | 补齐；如实标注「无服务端分页/搜索，本页内筛选」 | AC-…-INSTALLED_APPS-01 |
| 已安装应用详情 5 页签（基本信息/资源/事件/配置 values/YAML） | 补齐；升级回滚如实说明无接口 | AC-…-INSTALLED_APPS-02 |
| 卸载（用 cluster_id rls-…，非 release 名） | 补齐（确认框、失败保留输入） | AC-…-INSTALLED_APPS-03 |
| 商店详情页安装入口（台账「待开放」） | 补齐（安装弹窗含 values 配置） | AC-…-DETAIL-02；TC-…-DETAIL-02 |
| 安装 values 编辑 | 补齐（conf 必须是 YAML 字符串、恢复默认、清空=使用 chart 默认值） | AC-…-DETAIL-02 |

## 3. 数据契约与全链路（实测）

| 能力 | 请求 | 字段/语义 | 缺值/异常规则 |
| --- | --- | --- | --- |
| 仓库列表/详情 | GET /kapis/openpitrix.io/v1/workspaces/<ws>/repos、/repos/<id>、/repos/<id>/events | status（successful/failed）、status_time（零值显示 -）、credential JSON | 0 条显示空态；失败显示错误面板 + 重试 |
| 新增仓库 | POST 同集合 | 名称/url/providers/描述；同步周期写入注解 | 服务端拒绝显示原文，不新增行 |
| 同步索引 | POST /repos/<id>/action {action:index} | 成功重读列表 | 失败提示「同步失败：原因」 |
| 应用模板 | GET/POST /workspaces/<ws>/apps，/apps/<id>/versions，validate=true | version_type=helm、version_package(base64)、status 状态机 | 扩展名/2MiB 客户端拦截 |
| 已安装应用 | GET /workspaces/<ws>/applications（items/total_count） | cluster.cluster_id、app{name,app_id}、version{name,version_id}、status | 无分页器；本页内筛选 |
| 卸载 | DELETE /workspaces/<ws>/namespaces/<ns>/applications/<cluster_id> | 用 rls-… id | 异步删除：回读可能短暂仍有该 release（用例轮询 ≤90s） |
| 安装 | POST /workspaces/<ws>/namespaces/<ns>/applications | body {app_id,version_id,name,description,conf}；conf 必须 YAML 字符串（传对象报 json unmarshal 错误） | 失败保留表单并显示原因 |
| helmrelease 回读 | GET /apis/application.kubesphere.io/v1alpha1/helmreleases | 集群级对象；spec.values 为 base64；labels 带 app-id/app-version-id/namespace/workspace | 无自定义 values 显示「使用 chart 默认值」 |

## 4. 交互、视觉与复用

- 物理层次：主任务在右上主按钮（添加仓库 / 上传模板 / 安装），次操作收进行尾更多菜单；列表工具条固定为 搜索 + 刷新；空态给出两个出口（清空搜索与筛选 / 刷新），与并行 list-refresh 批次一致。
- 字段栅格：仓库列 名称/地址/类型/状态/创建者/创建时间；已安装应用 名称+描述/状态/应用/版本/项目/创建时间；模板 名称+描述/状态/最新版本/版本类型/更新时间/创建时间；窄屏按 hideBelow 隐藏次要列。
- 主题：沿用 ai-kit 语义 token（无硬编码色值）；状态用 Badge tone（success/warning/danger）。
- 复用：ResourceList/Modal/Select/Tabs/Button 来自 @kube-ai-hub/ui；安装弹窗被商店详情与模板详情共用；刷新统一走 components/resource/useListRefresh。
- 链接：仓库名 → 仓库详情；应用名 → 商店详情/模板详情；卸载后回到列表并重读。

## 5. 本批修复的缺陷

1. locale 反串：zh 块内若干 appRepos.* 值是英文（中文界面出现 Add repository），en 块内是中文；已互换并按 AC-…-WORKSPACE_REPOS-07 校验双语。
2. 版本审核按钮渲染原始 key：api-client 的 VERSION_STATUS_ACTION.labelKey 指向不存在的 appTemplates.action.*，页面显示 appTemplates.action.submit。改为既有键 appRepos.apps.action.{submit,resubmit,cancel,release,suspend,recover}（TC-…-WORKSPACE_APPS-02 抓出）。
3. 用例层：卸载改轮询等待异步删除；安装弹窗 values 断言与弹窗默认版本对齐；仓库/模板创建后的清理改为稳定回读。

## 6. 完成判定与证据

| 维度 | 状态 | 证据/命令 | 未通过或未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 上表全部有归宿；PRD 明确不做逐条给实测理由 | 项目级「应用」页、商店管理写操作、模板图标/截图/分类编辑、版本 YAML 编辑未纳入本单元（登记为后续批次） |
| 数据语义 | 通过 | 请求→映射→展示逐项核对；conf 必须 YAML 字符串、cluster_id 卸载、无分页器如实标注 | 升级/回滚无接口，页面说明不提供控件 |
| 交互与权限 | 通过 | 写用例均回读并清理（自建仓库/模板/release 唯一前缀）；SSAR 门控用例覆盖 | member 集群写入、跨作用域授权未验收 |
| 视觉与主题 | 部分通过 | 1280 全页 + 1024/1600 关键页 + 英文截图人工核对；见 /tmp/appstore-*.png | 浅色主题与第二套色调未逐页截图 |
| 静态/类型/构建/测试 | 通过 | api-client src tsc 0；console-next tsc 0；vite build ✓；app-store E2E 15 passed（`-m ui -n 0`，92.41s，2026-11-15 21:5x 复跑）；check_docs --strict 本单元范围 errors=0 warnings=0 | 全仓串行 E2E 未跑 |
| 本地全栈/B200 | 通过（读+写） | BFF 8092 → B200；仓库创建/模板上传/安装/卸载均真实写入并清理 | — |
| 新版部署/member/全站 | 未验收 | — | 生产前端与 member 集群未执行 |

截图：/tmp/appstore-repos-1024.png、appstore-repos-1280.png、appstore-repos-1600.png、appstore-repos-detail-1280.png、appstore-ws-apps-1280.png、appstore-installed-1280.png、appstore-installed-1600.png、appstore-store-detail-1280.png、appstore-repos-en-1280.png、appstore-installed-en-1280.png。
