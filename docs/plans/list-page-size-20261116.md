# 列表每页条数选择器（10/20/50/100）

> 单元：CHECK-08「通用列表、详情结构及公共组件接入」中的分页档位能力。日期 2026-11-16。
> 规格：prd|design/kube-frontend/configmaps/list.md（AC-CONFIGMAPS-LIST-08、DEC/CON/GOT-…-08）。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务 | 读者按自己的节奏翻列表：一屏看 10 条还是 50 条，由他决定，而不是写死在代码里 |
| 旧能力 | `components/Tables/Base/Pagination` + `PAGESIZE_OPTION = [10, 20, 50, 100]`（`utils/constants.js:1226`），每个列表页都有选择器 |
| 新 UI 现状 | 58 个 ResourceList 页面里只有 5 个有档位；配置字典/保密字典/服务账号/项目工作负载都写死 `const PAGE_SIZE = 10` |
| 本批范围 | 配置字典、保密字典、服务账号、项目工作负载（8 个 kind 共用一个列表组件） |

## 2. 旧能力与归宿

| 旧能力 | 归宿 | AC / 用例 |
| --- | --- | --- |
| 每页条数档位 10/20/50/100 | **补齐**（四个页面族接入，共用 `useResourceListState.pageSize`） | AC-CONFIGMAPS-LIST-08；TC-CONFIGMAPS-LIST-08 |
| 切换档位回到第 1 页 | **补齐**（`setPageSize` 同时 `setPage(1)`） | 同上 |
| 分页总数与页码跟随档位 | 保留（`total` 来自服务端，页码由档位重算） | 同上 |
| 其余页面族的档位 | 待补（其余约 45 个列表仍固定 10/20 条；同一套状态已就绪，按页族推进） | 登记在矩阵 CHECK-08 |

## 3. 数据契约

`GET …/<resource>?page=<n>&limit=<pageSize>&sortBy=<key>&ascending=<bool>`；切换档位时 `page=1`。
共享 `ResourceList` 只在**同时**给出 `pagination.pageSizeOptions` 与 `onPageSizeChange` 时渲染选择器（GOT-08）。

## 4. 交互与视觉

- 选择器位于分页条左侧，形如「第 1-4 条，共 4 条　[10 ▾] / 页」；三档视口无横向溢出。
- 中文/英文文案沿用 ai-kit 默认标签（`pageSize` / `pageSizeSuffix`），不新增键。

## 5. 编码与回归

- `toListParams(state, base)` 的第三个参数改为**可选**：省略时跟随 `state.pageSize`。传常量正是「表格说 50 条、请求只要 10 条」这个 bug 的来源；保留重载是为了不动那些故意固定页大小的面板表格。
- 配置字典的列表控制器（`pages/configmaps/controller.ts`）把页大小从入参提升为状态，并导出 `setPageSize`。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未通过或未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（本批 4 个页面族） | 上表；其余页族已登记待补，不进本批分母 | 约 45 个列表仍固定档位 |
| 数据语义 | 通过 | 选 50 后请求为 `page=1&limit=50`，行数等于服务端返回；选择器显示 50 | — |
| 交互与权限 | 通过 | 四个页面族逐一验证（configmaps/secrets/serviceaccounts/deployments） | — |
| 视觉与主题 | 通过（人工） | `/tmp/list-page-size-{1024,1280,1600}.png`、`/tmp/list-page-size-en-1280.png`；三档 overflow=0 | 浅色/第二色调未验 |
| 静态/类型/构建/测试 | 通过 | check_docs --strict 本批 0/0；console-next tsc 0；vite build ✓；E2E 串行 configmaps+secrets+serviceaccounts **54 passed / 2 skipped** | 全站串行 E2E 未跑 |
| 本地全栈/B200 | 通过 | BFF→B200 真实分页请求 | 部署环境未验 |
