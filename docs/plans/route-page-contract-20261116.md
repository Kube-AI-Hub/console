# 路由与页面一致性契约（2026-11-16）

> 新增 `kube-frontend/config/route-page-contract.test.ts`（3 条），顺手删掉一个改版遗留的死页面。

## 1. 为什么要它

迁移到 180 个页面后出现两类问题，`tsc` 与既有页面契约都抓不到：

| 类别 | 说明 |
| --- | --- |
| 路由指向不存在的页面模块 | 路由文件 `import '@/pages/...'` 目标被改名/删除后，运行期整棵路由表在 import 阶段就崩，报错信息比类型错误难懂得多 |
| 改版遗留的死页面 | 新页面接手后老页面文件仍在导出 `XxxPage`，没有任何地方引用，读者会误以为它是当前实现 |

## 2. 三条断言

1. **清单自检**：路由文件 > 100、页面文件 > 100（防止有人误删目录后契约静默通过）；
2. **路由只 import 存在的页面模块**：把每个 `@/pages/...` 说明符按 `.tsx`/`.ts`/`index` 解析，必须命中真实文件；
3. **没有未被引用的页面组件**：对每个 `export function XxxPage(`，必须能在**其它**源码文件里找到该名字——
   这样既覆盖路由引用，也覆盖「页面套页面」（如 `MonitoringListPage` 渲染 `RuleGroupsPage`）。

## 3. 首跑就抓到一个真的死页面

`pages/platform/PlatformSettingsPage.tsx`（早期把「平台信息 + 通知渠道」合在一页的实现）。
改版后真正的路由是 `/settings/info` → `PlatformInfoPage`、`/settings/webhook|dingtalk|wecom|slack|mail|feishu` → `ChannelConfigPage`，
而 `PlatformSettingsPage` **没有任何引用**，`PlatformSettingsPageProps.view` 的分支再也不会执行。

处理：删除该文件；同步修正两处把它当作「当前实现」的设计文档（`design/kube-frontend/platform-settings/{_index,info}.md`）——
文档指向一个路由不使用的文件，本身就是误导。

## 4. 一次误报与修正

首版把 `.ts` 辅助文件也算进「页面组件」，于是 `pages/app-workloads/queries.ts` 里的 `registerWorkloadPage`（普通函数）被误报。
修正为：引用检查只看 `.tsx`（组件只会写在 `.tsx` 里），`.ts` 仍参与 import 解析。

## 5. 结果

| 项 | 结果 |
| --- | --- |
| 路由文件 / 页面文件 | 251 / 页面清单 > 100 |
| 未解析的路由 import | **0** |
| 未被引用的页面组件 | **0**（删除死页面后） |
| 契约套件 | **12 个文件 / 1454 passed** |
| `vite build` | **✓** |
| 全仓门禁 `check_docs --strict` | **errors=0 warnings=0** |
