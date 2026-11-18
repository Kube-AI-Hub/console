# 两侧页面清单（2026-11-18 复验底稿）

> **本文件是事实底稿，由脚本从源码抽取，不手写结论。**
> 老 console 事实源：`console/src/pages/*/routes/*.js`；新 UI 事实源：`console/kube-frontend/apps/console-next/src/routes/`（目录即路由）。
> 历史基线（2026-11-14、2026-11-17）保留在文末。

## 1. 老 console 路由（脚本枚举，**199** 条）

| 作用域 | 路由 | 详情页 | 列表/其它 |
| --- | ---: | ---: | ---: |
| 全局 `src/pages/console` | 6 | 0 | 6 |
| 平台访问控制 `access` | 5 | 2 | 3 |
| 平台设置 `settings` | 9 | 0 | 9 |
| 应用商店 `apps` | 7 | 2 | 5 |
| 企业空间 `workspaces` | 14 | 4 | 10 |
| DevOps 工程 `devops` | 11 | 3 | 8 |
| 联邦项目 `fedprojects` | 23 | 9 | 14 |
| 集群 `clusters` | 74 | 34 | 40 |
| 项目 `projects` | 50 | 21 | 29 |
| **合计** | **199** | **75** | **124** |

### 1.1 分母变了：旧代码被删了一页

**200 → 199**，不是新 UI 少做了什么，而是**旧 console 的 `/support` 页连同其后端被删除了**：

````
9d3617d3a 2026-11-17 refactor(console): remove the /support page and everything behind it
src/pages/console/containers/Support/index.jsx
```

这是 2026-11-14 以来 `src/pages` 下**唯一**一次删除（`git log --diff-filter=D` 全量核对）。
所以原先那条「支持页 = 批准不做」的登记已随源码消失而作废——**不是迁移缺口，是分母变化**。

> 另有 `src/pages/terminal`（独立新窗口，3 种模式）与 `getChildRoutes` 动态生成的子页签
> （企业空间 overview 3 个、灰度发布 2 个）不计入这 199。

## 2. 新 UI 路由（目录枚举，**104** 个 `route.tsx`）

| 作用域 | 路由目录 |
| --- | ---: |
| 项目 `kube-frontend.$workspace.clusters.$cluster.projects.$namespace` | 29 |
| 集群 `kube-frontend.clusters.$cluster` | 47 |
| 企业空间 `kube-frontend.workspaces.$workspace` | 10 |
| 平台访问控制 `kube-frontend.access` | 4 |
| 平台设置 `kube-frontend.settings` | 9 |
| 应用商店 `kube-frontend.apps` + `apps-manage` | 5 |
| **合计** | **104** |

另有若干扁平 `index.tsx` / `$name.tsx` 文件路由，以及顶层 `index`、`kube-frontend.index`、
`clusters.index`、`login`、`$.tsx`（404 兜底）。页面组件共 **203** 个 `.tsx`。

### 2.1 与历史基线的差异

| 时点 | 新 UI 路由 | 老 console 路由 | 说明 |
| --- | ---: | ---: | --- |
| 2026-11-14 | 65 | 200 | 企业空间/DevOps/联邦/应用商店四个作用域整块缺失 |
| 2026-11-17 | 100 | 200 | 四作用域已交付；14 项重纳登记完成 |
| **2026-11-18** | **104** | **199** | 14 项重纳全部交付；集群监控恢复 5 页签；旧 `/support` 删除 |

## 3. 复现方式

````bash
cd /Users/yuan/code/kube-ai-hub/console

# 页面段级归宿（老 URL 段 → 已迁移/不做/别处承接/缺口）
python3 prd/tools/gap_check.py --strict     # 已迁移 93 / 明确不做 0 / 别处承接 3 / 缺口 0 / 未归类 0

# 已登记页面 ↔ 规格 ↔ 测试
python3 prd/tools/parity_check.py           # 缺口 0 / 多余路由 0 / 未登记区域 0 / 无用例规格 0

# 新 UI 页面数
cd kube-frontend/apps/console-next/src/routes
find . -name 'route.tsx' | wc -l            # 104
```

> **口径提醒**：`gap_check.py` 的 `SCOPE_DIRS` 只覆盖 clusters/projects/access/settings/apps/workspaces 六个作用域，
> **不含 `console` 与 `terminal`**。那 10 条全局路由（工作台/日志/事件/审计/账单/404/终端三模式）
> 的归宿见 [`10-platform.md`](./10-platform.md) 的人工核对，不在「93 / 0」里。

逐条映射见 [50-appendix-mapping.md](./50-appendix-mapping.md)。

## 4. 历史基线（不再作为当前状态）

- **2026-11-14**：老 200 条路由；新 UI 仅 65 页；四个作用域整块不存在、无 404 兜底。
  当时结论「115 页面真缺失 / 22 有替代 / 31 疑似回归」**已被推翻**。
- **2026-11-17**：老 200；新 100；页面级真缺口 2（快照类型详情、项目网关详情）；能力级 51 条。
  **已被 2026-11-18 推翻**（两项均已交付，能力级登记缺口归零）。
