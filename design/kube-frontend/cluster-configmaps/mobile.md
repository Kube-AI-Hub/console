# 移动端适配 · 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/mobile.md`](../../../prd/kube-frontend/cluster-configmaps/mobile.md)。

## 概述

手机宽度下的列折叠与横向滚动边界。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01`

## 设计目标与非目标

**目标**：套用与项目级相同的断点规则，只把「项目」列排除在折叠之外。

**非目标**：不为手机单独做卡片布局。

## 关键约束

- 触控目标 ≥ 44px；表格在自身容器内横向滚动。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01 — 「项目」列不折叠

**为什么**：名称只在项目内唯一。手机上藏掉项目列后，两行同名数据无法区分，「删除」变成赌博。

**被否方案**：把项目做成名称下方的第二行。可行但会让每行更高，且与详情页的属性区重复；先保留独立列，必要时再加。

## 系统现状

`Table` 的 `hideBelow` 已支持按断点折叠；`styles.css` 里没有全局横向滚动条。

## 仓库落点

- `apps/console-next/src/pages/configmaps/ClusterConfigMapsPage.tsx`（列定义）

## 对外契约

- 无接口变化。

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01** — 390px 下 `documentElement.scrollWidth == clientWidth`。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01** — 截图上的宽度看起来超过视口时先量 `scrollWidth`；deviceScaleFactor 会让图片变宽，那不是溢出。

## 测试与可观测

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01`

## 后续改进

- 若项目名过长影响可读性，改为名称下方第二行。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01`
