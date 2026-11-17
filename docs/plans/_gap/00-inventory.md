# 两侧页面清单（2026-11-17 复验底稿）

> **本文件是事实底稿，由脚本从源码抽取，不手写结论。**
> 老 console 事实源：`console/src/pages/*/routes/*.js`（脚本见 §3）。
> 新 UI 事实源：`console/kube-frontend/apps/console-next/src/routes/`（目录即路由）。
> 上一版（2026-11-14）的清单保留在文末，标注为历史基线。

## 1. 老 console 路由（脚本枚举，200 条）

| 作用域 | 路由 | 详情页 | 列表/其它 |
| --- | ---: | ---: | ---: |
| 全局 `src/pages/console` | 7 | 0 | 7 |
| 平台访问控制 `access` | 5 | 2 | 3 |
| 平台设置 `settings` | 9 | 0 | 9 |
| 应用商店 `apps` | 7 | 2 | 5 |
| 企业空间 `workspaces` | 14 | 4 | 10 |
| DevOps 工程 `devops` | 11 | 3 | 8 |
| 联邦项目 `fedprojects` | 23 | 9 | 14 |
| 集群 `clusters` | 74 | 34 | 40 |
| 项目 `projects` | 50 | 21 | 29 |
| **合计** | **200** | **75** | **125** |

> 另有 `src/pages/terminal`（独立新窗口，3 种模式）与 `getChildRoutes` 动态生成的子页签（企业空间 overview 3 个、灰度发布 2 个）不计入这 200。
> 数字与 2026-11-14 一致——**旧源码没有变**，变的是新 UI。

## 2. 新 UI 路由（目录枚举，100 个路由目录 + 4 个顶层文件）

| 作用域 | 路由目录 | 说明 |
| --- | ---: | --- |
| 项目 `kube-frontend.$workspace.clusters.$cluster.projects.$namespace` | 26 | 含 15 个 `$name` 详情 |
| 集群 `kube-frontend.clusters.$cluster` | 45 | 含 12 个详情；2026-11-14 时为 13 个 |
| 企业空间 `kube-frontend.workspaces.$workspace` | 11 | 2026-11-14 时不存在 |
| 平台访问控制 `kube-frontend.access` | 3 | 含 3 个详情 |
| 平台设置 `kube-frontend.settings` | 7 | 含 6 个通知渠道 |
| 应用商店 `kube-frontend.apps` / `apps-manage` | 5 | 2026-11-14 时不存在 |
| 顶层 | 5 | `index`、`kube-frontend.index`、`clusters.index`、`login`、`$.tsx`（404 兜底） |
| **合计** | **100 个 `route.tsx`** | 另有若干扁平 `index.tsx` / `$name.tsx` 文件路由 |

**与 2026-11-14 的关键差异**：集群页面 13 → 45，新增企业空间作用域（11）、应用商店（5）、404 兜底；项目作用域 22 → 26。

## 3. 复现方式

老 console 路由计数（与 2026-11-14 相同脚本）：

```bash
cd /Users/yuan/code/kube-ai-hub/console
python3 prd/tools/gap_check.py            # 段级归宿：91 已迁移 / 2 不做 / 3 别处承接 / 0 未归类
python3 prd/tools/parity_check.py         # 已登记页面 ↔ 规格 ↔ 测试
```

新 UI 页面数：

```bash
cd kube-frontend/apps/console-next/src/routes
find . -name 'route.tsx' | wc -l          # 100
find . -name 'index.tsx' | wc -l          # 列表页
find . -name '$*.tsx' | wc -l             # 详情页（扁平文件路由）
```

逐条映射见 [50-appendix-mapping.md](./50-appendix-mapping.md)。

## 4. 历史基线（2026-11-14，不再作为当前状态）

当时的清单：老 200 条路由；新 UI 仅 65 个页面（项目 22、集群 13、平台 3+3、设置 3、顶层 4），
企业空间 / DevOps / 联邦项目 / 应用商店四个作用域**整块不存在**，无 404 兜底。
当时的缺口分析结论（115 真缺失 / 22 有替代 / 31 疑似回归）**已被 2026-11-17 复验推翻**，不要复制。
