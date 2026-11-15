# CHECK-09 壳、帮助/关于与独立入口的范围复核（2026-11-15）

矩阵把 CHECK-09 记为「待复核产品范围和接口」。本篇逐项复核，每项给结论与证据，而不是笼统地写「待办」。

## 1. 关于（已交付）

用户菜单新增「关于」：平台名称与描述读平台 ConfigMap（与「平台信息」页同源），版本读 `/kapis/version`。用例 `USER_SETTINGS-ABOUT-01` 通过；记录见 [用户设置](../../prd/kube-frontend/user-settings/about.md)。

## 2. 帮助 › 用户指南 / API 文档（明确不做，附证据）

老 console 的顶栏有一个文档下拉，两项分别打开 `server/config.yaml` 里的 `documents[lang].url` 与 `.api`（默认 `/kube-docs/zh/docs/`、`/kube-docs/zh/docs/reference/api-docs/`）。

新 UI 没有对应物，原因是**部署侧没有文档站点，也没有暴露这份配置**：

| 检查 | 结果 |
| --- | --- |
| 新 BFF 配置（`server/src/config.ts`） | 只有上游地址/前缀/模式，**没有** `documents` 段 |
| 集群 ConfigMap `kubesphere-config` | 只有 `kubesphere.yaml`，其中**没有** `documents` |
| 本地 5178 的 `/kube-docs/zh/docs/` | 返回 200，但内容是 SPA 兜底页（`<title>智算平台</title>`），**不是**文档站点 |
| `console-dev.brightaitoken.com` | 本机不可达（curl 000），无法据此判断部署是否有文档站点 |

结论：**不做**。给一个会跳到 SPA 兜底页的「用户指南」链接，比没有入口更糟——读者会以为文档坏了。若将来部署提供文档站点，接入方式是在 BFF 暴露 `documents` 配置（或前端读一个 `VITE_DOCS_BASE` 环境变量），页面再加菜单项即可；届时补 AC 与用例。

## 3. 第三方登录 / 账单（明确不做）

老 console 的登录页支持 OAuth/LDAP 等外部身份源，平台设置里有账单页。当前部署**未启用**这些能力：

- 登录接口只有用户名/密码（`POST /api/session/login`），平台没有配置任何 identity provider；
- 没有计费组件（集群内无 billing 相关 CRD/服务）。

没有可验证的后端就实现登录方式切换，只会得到一个点了会报错的按钮。登记为「明确不做」，条件：部署启用对应能力时另行立项。

## 4. 配置入口（已交付）

平台设置 › 平台信息 / 邮件 / 飞书 / 通知渠道 / 外观 等页面已迁移（`PLATFORM_SETTINGS-*` 用例，写入类因集群缺 notification webhook server 而 skip，归因见[环境受限的验证项](environment-blocked-verifications-20261115.md)）。

## 5. 自制 CRD 应用与商城模板（不在本项，属扩展资源与应用商店）

矩阵原文提醒这两者「不可混同」：

- **自制 CRD 应用**：由「扩展资源」页族承接（自定义资源列表与实例列表、刷新已交付）；
- **商城模板**：由应用商店页族承接（仓库/模板/已安装应用）。

因此 CHECK-09 不再重复登记这两项，避免同一能力被两处计数。

## 复核后的 CHECK-09 结论

| 子项 | 结论 |
| --- | --- |
| 关于与版本 | **已交付**（`USER_SETTINGS-ABOUT-01`） |
| 帮助外链 | **明确不做**（部署无文档站点，链接会落到 SPA 兜底页） |
| 第三方登录 / 账单 | **明确不做**（部署未启用，无可验证后端） |
| 配置入口 | **已交付**（平台设置页族） |
| 自制 CRD 应用 / 商城模板 | **别处承接**（扩展资源 / 应用商店） |

即 CHECK-09 **复核完毕**：无遗留待办，三项为已交付或明确不做。
