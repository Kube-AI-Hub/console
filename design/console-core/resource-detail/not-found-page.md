# 404 兜底页 · 技术方案（L3）

[子模块需求](../../../prd/console-core/resource-detail/not-found-page.md)

## 概述

`src/routes/$.tsx` 的 catch-all 路由 + `components/NotFoundPage.tsx`。

## 关联需求

- AC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01

## 设计目标与非目标

目标：未知路径有明确落地页且保留外壳。非目标：按旧地址重定向、相似页面推荐。

## 关键约束

- TanStack Router 的文件式 catch-all：`routes/$.tsx` → 路径 `/$`。
- 该页在 `__root` 之外但与其它页同级，因此外壳（侧栏）仍在。

## 方案决策

### DEC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01 — 说明而不是猜测

**为什么**：不知道用户本来想去哪。重定向到某个「最可能」的页面会让人以为链接有效，把问题掩盖到下一次操作才爆。
**被否方案**：老地址映射表。老 console 与新 UI 的地址差异不只是前缀（作用域、页签名都变过），映射表只会带来新的错误页面。
**何时重新考虑**：有稳定的地址映射需求（例如对外分享的固定链接）时。

## 系统现状

老 console：`routes/index.js:162` 的兜底组件。新 UI：此前空缺，未知路径渲染空壳。

## 仓库落点

- 页面：`apps/console-next/src/components/NotFoundPage.tsx`
- 路由：`apps/console-next/src/routes/$.tsx`

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 兜底路由 | 前端 `/$`（catch-all） |

## 不变量

1. 未知路径 → 404 页，不出现空白主区域。
2. 返回入口指向 `/kube-frontend`。

## 已知坑

- **catch-all 不能放在 `__root` 之前**：TanStack 的 `$.tsx` 若与某个具名路由同形会被遮蔽；放在 routes 根下即可。
- **未使用 import**：`React` 在无 JSX pragma 需求时会触发 `noUnusedLocals`。

## 测试与可观测

用例：`tests/ui/specs/console-core/resource-detail/TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01.yaml`
可观测点：`not-found:surface`、`not-found:title`。

## 后续改进

- 若出现对外固定链接需求，再引入地址映射。

## 验收用例

- TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01