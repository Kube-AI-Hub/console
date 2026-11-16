# 空态契约（2026-11-16）

> 新增 `kube-frontend/config/empty-state-contract.test.ts`（3 条）。守住迁移里最难的一条规矩：
> **「本来就没有」不能和「加载失败」「值为 0」混在一起**。

## 1. 问题

`ResourceList` 在 rows 为空时渲染的是一张**空表格**——没有表头行以外的任何说明。读者（和人一样）无法区分：

- 这个集群确实没有网络策略（正常空）；
- 数据还没到（loading）；
- 请求失败了（error）；
- 没有权限（forbidden）。

所以每个列表的 schema 都必须写 `empty.title`（可带 description），把「没有」说清楚。

## 2. 三条断言

| 断言 | 内容 |
| --- | --- |
| 清单自检 | 使用 `ResourceList` 的文件 > 40（防目录误删后静默通过） |
| 每个列表都要说明「为什么空」 | 含 `<ResourceList` 的文件必须有 `empty: {`，否则列入失败清单 |
| 例外必须诚实 | 自行渲染空态块的页面（当前仅项目自定义监控）必须同时有 `=== 'empty'` 状态机与 `:empty` 句柄 |

## 3. 唯一例外的理由

`monitoring/ProjectCustomMonitoringPage.tsx`：它的列表只在 `state==='ready'` 时渲染，空态是一个**页面级块**
（自带 `data-ai-id="project-custom-monitoring:empty"`），因为「让 agent 检查空态」不该被迫穿过一张不存在的表。
契约要求这个例外**必须**保持状态机与句柄，否则视为退化。

## 4. 反向验证

把 `IpPoolsPage.tsx` 的 `empty: {` 改名成 `emptyX: {` → 契约立刻失败并列出该文件；恢复后全绿。

## 5. 结果

| 项 | 结果 |
| --- | --- |
| 使用 ResourceList 的文件 | 58 |
| 缺 `schema.empty` | **0** |
| 例外 | 1（有状态机 + 句柄双重守卫） |
| 契约套件 | **14 文件 / 1462 passed** |
| `vite build` | **✓** |
