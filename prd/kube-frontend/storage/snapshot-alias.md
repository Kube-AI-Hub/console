# 快照别名路由（L3）

[子模块需求](./_index.md)

## 概述

老 console 的快照列表有两个地址：`/volume-snapshots` 与更短的 `/snapshots/:namespace?`。后者是仍会出现在书签与脚本里的地址，本页把它**重定向**到前者，而不是 404。

## 用户故事

### US1 - 旧书签仍然可用 (Priority: P3)

作为 **使用者**，我希望 **打开旧的 `/snapshots` 地址时仍能看到快照列表**，以便 **不因为一次路径调整而重新找入口**。

**Independent Test**：访问 `/clusters/<c>/snapshots`，最终落在 `/volume-snapshots` 且列表可见。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01** — 已知快照列表页可用，当访问 `/clusters/<c>/snapshots`（以及 `/clusters/<c>/snapshots/<namespace>`），则浏览器重定向到 `/clusters/<c>/volume-snapshots` 并显示列表，而不是 404。

## 设计目标

1. 把「快照是否真的存在于后端」的判定依据放在一屏内。
2. 不存在/未安装等情况给出明确说明，而不是空白页。

## 约束与边界

- 只读；不编辑、不删除快照内容（由 CSI 控制器管理）。
- 依赖 `snapshot.storage.k8s.io/v1` 已安装；未安装时按接口错误处理。

## UI 交互设计

- 无界面：纯重定向。

## 文案与校验

- 无。

## 边界情况

- 带命名空间段的旧地址：同样重定向（老页面里该参数只影响过滤，不影响页面身份）。

## 明确不做

- 保留 `/snapshots` 作为独立页面：同一份列表没有第二个地址的必要，重定向比重复实现便宜且不会分叉。

## 假设

- 旧地址只用于快照列表，没有别的语义。

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01** — `/snapshots` 重定向到 `/volume-snapshots`。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01** — 两个旧形态都落到列表页。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01`
