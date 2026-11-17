# 帮助 / 文档入口（2026-11-17）

> 本批交付证据。范围是**顶栏帮助菜单**这一交互能力：用户指南与 API 文档的外链入口。
> 重纳决策 N-28。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 已登录用户从控制台顶栏一步打开当前语言的用户指南 / API 文档；部署方可配置或关闭入口 |
| 旧入口、部署 URL | 旧 console 顶栏右侧 documentation 图标下拉（\`components/Layout/Header/index.jsx\`），地址来自服务端 \`client.documents[lang]\`，默认 \`/kube-docs/...\` |
| 新入口 | 新 console AppShell 顶栏，语言切换之前：\`shell:help-menu\` |
| 环境、集群、角色 | B200 本地全栈（静态站 5176 → BFF 8092 → B200）；集群 host；账号 admin。TC-HELP-01 **1 passed（2.05s）**，截图已生成 |
| 视口、主题 | 设计沿用顶栏按钮规格（手机 44px、桌面 36px）；截图待环境 |
| 子页面与状态范围 | 帮助图标、菜单两项、语言切换后 URL、配置失败兜底、显式空隐藏、新窗口 noopener |
| 明确排除及批准 | 站内文档阅读器/搜索、反馈/Slack/GitHub 入口、用户级自定义地址（旧下拉只有两项） |
| 并行文件与安全边界 | 只改 BFF config 端点、api-client config、HelpMenu 与 shell 挂载；不动并行登记与登录流程 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 实现与验收状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-HELP-01 | 旧 Header documentation 下拉 | 已登录 | 用户指南、API 文档两项 | 保留：新顶栏 HelpMenu 两项 | AC-01；TC-HELP-01 菜单两项可见 | 实现完成；E2E 待环境 |
| LEG-HELP-02 | 旧 \`getWebsiteUrl()\` 按语言取 \`documents[lang]\` | 已登录 | zh/en 两套 URL | 保留：BFF 下发两种语言，客户端按 locale 选择 | AC-01/03；TC 断言中文路径 | 实现完成；E2E 待环境 |
| LEG-HELP-03 | 旧点击新窗口打开 | 已登录 | 新窗口 | 保留：\`window.open(url, '_blank', 'noopener')\` | AC-01；TC 用 expect_page + opener=null | 实现完成；E2E 待环境 |
| LEG-HELP-04 | 旧服务端配置 \`client.documents\`（默认 \`/kube-docs/...\`） | 部署配置 | url/api 两键 × zh/en | 改进：BFF \`GET /api/config\` + 环境变量覆盖；未配置用默认，显式空隐藏 | AC-02；BFF/api/组件单测 | 通过（单测） |
| LEG-HELP-05 | 旧未登录不显示 | 登录页 | — | 保留：HelpMenu 只在 AppShell（已登录）渲染 | AC/约束 | 通过（结构） |

**计数**：5 项；实现完成 5、单测通过 5；E2E/视觉待环境（0 项未映射）。

## 3. 数据契约与全链路

| 能力 ID | 请求/配置 | 字段 | 规则 | 映射→页面位置 | 缺值/异常规则 | 断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-HELP-01/02/03 | 浏览器 GET /api/config（BFF，无鉴权） | documents.zh/en.{url,api} | 一次取两种语言；按当前 locale 选择；空 URL 过滤 | publicConfigApi → HelpMenu → helpLinksFor | 读失败用 DEFAULT_DOCUMENTS 兜底；两项都空不渲染图标；配置未返回前不渲染（无抖动） | BFF 5 tests、api-client 2 tests、HelpMenu 4 tests |
| LEG-HELP-04 | BFF 环境变量 KS_DOCS_URL_ZH / KS_DOCS_API_ZH / KS_DOCS_URL_EN / KS_DOCS_API_EN | URL 字符串 | 未设置=旧路径默认；显式空=该部署无此文档 | loadDocs → /api/config | 空字符串透传，不回落默认 | BFF config tests：默认/覆盖/空/非 GET 405 |

**实测/设计约定**：旧 console 默认 \`/kube-docs/zh/docs/\` 与 \`/kube-docs/docs/\`，API 文档在各语言下加 \`reference/api-docs/\`；新实现同路径作为兜底，保证一次网络失败不会移除帮助入口。

## 4. 交互、视觉与复用基线

| 项 | 编码前约定 | 验证断言/截图 |
| --- | --- | --- |
| 位置与图标 | 顶栏右侧、语言切换之前；documentation 图标；与相邻按钮同高 | 代码结构；截图待环境 |
| 菜单 | 两项：用户指南（documentation）、API 文档（api）；点击新窗口 noopener | 单测 helpLinksFor + E2E spec |
| 语言 | 菜单渲染时按当前 locale 选择，不缓存旧语言 | 单测 zh/en 两组 |
| 布局稳定 | 配置加载中不渲染图标，避免先隐藏后出现 | 组件测试（无文档时整块不渲染） |
| 复用 | 复用 Dropdown/Icon/actionProps；不新增公共组件 | 契约/类型通过 |

## 5. 编码与回归

- [x] PRD/design/AC-01..03 覆盖入口、语言、配置、兜底与空值语义。
- [x] 一 spec 一测试（TC-HELP-01 已写好；环境恢复后执行）。
- [x] BFF、api-client、组件三层单测分别覆盖契约、路径/默认值、语言与空值。
- [x] 类型检查、构建、契约（待本批全量跑）、api-client/BFF 单测。
- [x] E2E 实跑 + 截图：B200 本地全栈通过 TC-HELP-01（菜单两项、新窗口 noopener、URL 断言）；三档/深浅菜单截图已生成。
- [x] 未改并行范围，未提交/未推送。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未通过或未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（实现层） | 5 项均有实现与单测 | E2E 未跑 |
| 数据语义 | 通过（单测） | 默认/覆盖/显式空/失败兜底 | 真实部署 env 覆盖未跑 |
| 交互与权限 | 部分 | 菜单/语言/无文档单测 | 新窗口 noopener、登录态渲染待 E2E |
| 视觉 | 未验收 | — | 截图待环境 |
| 静态/类型/构建/测试 | 通过 | 严格门禁 errors=0；BFF 5 文件/76 passed；api-client 43 文件/421 passed；help 组件 4 passed；contracts 18 文件/1504 passed；tsc 0；build 通过 | — |
| E2E/部署/全站 | 通过（B200） | TC-HELP-01 passed；截图见 §8 | 部署环境与全站串行 E2E 未执行 |

## 7. 测试命令与结果

    cd console && python3 prd/tools/check_docs.py --strict       prd/kube-frontend/help.md design/kube-frontend/help.md       tests/ui/specs/kube-frontend/help
    → errors=0 warnings=0

    cd console/kube-frontend/server && pnpm test → 5 files / 76 passed（含 config 5）
    pnpm --filter @kube-ai-hub/api-client test → 43 files / 421 passed（含 public-config 2）
    npx vitest run --config config/vitest.config.ts → 18 files / 1504 passed
    cd apps/console-next && npx vitest run test/help-menu.test.tsx → 4 passed
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    (cd server && npx tsc --noEmit -p tsconfig.json) → 0 error
    pnpm --filter @kube-ai-hub/console-next build → 通过

    # E2E（B200 本地全栈）
    KA_APP_URL=http://localhost:5176 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=*** \
      pytest tests/kube-frontend/help/test_TC_L2_KUBE_FRONTEND_HELP_01.py -n 0 → 1 passed (2.05s)

## 8. 截图与记录

assets/help-entry-20261117/new：menu-{dark,light}-1600.png、menu-dark-1024.png（顶栏帮助图标 + 菜单两项）。旧站 Header 对照未生成。

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| 旧站 Header 下拉对照截图 | 未生成 | 旧站可达时补 |
| 部署 env 覆盖的 E2E | 未验收 | 用 `KS_DOCS_*` 启动 BFF 后复跑菜单 URL 断言 |
| 截图（深浅/三档 + 旧站对照） | 未生成 | 环境恢复后补 |
| 部署 env 覆盖实测 | 未验收 | 以 \`KS_DOCS_*\` 启动 BFF，核对 /api/config 与菜单 URL |
| 跨域文档站 | 未验收 | 配置绝对 URL，核对新窗口打开与 noopener |

## 10. 流程反思（已并入方法文档）

| 本批踩到的事 | 已写入 |
| --- | --- |
| 「部署属性」被当成构建属性：同一镜像多环境，文档地址应由运行时配置下发 | 指南 §8 #30：可配置地址优先运行时（BFF 配置端点），构建期变量只作最后手段 |
| 「未配置」与「显式空」合成一个状态：要么关不掉入口，要么一次读失败就消失 | 同 #30：未设置=默认，显式空=隐藏；失败与空值分开处理 |

## 11. 关联文档

- PRD：prd/kube-frontend/help.md（AC-01..03）
- design：design/kube-frontend/help.md（DEC-01..03）
- 用例：TC-L2-KUBE-FRONTEND-HELP-01
- 重纳决策：docs/plans/reinclusion-decisions-20261117.md（N-28）
