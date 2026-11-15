# 项目设置列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/settings-lists-refresh.md)

## 概述

`NetworkIsolationPage` 接 `policies` 查询；`SettingsListPage` 接 `query`（成员或角色取决于 `kind`）。

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01

## 设计目标与非目标

目标：三个列表都能主动重读。非目标：轮询、watch、刷新隔离开关。

## 关键约束

- `busy` 进入 schema，schema 的 useMemo 依赖必须包含 `query.isFetching`（网络隔离页的依赖数组原先只有 `[list, t, total]`）。
- 网络隔离页的 `policies` 查询与 `isolation` 查询并存：刷新只重读 `policies`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01 — 刷新不改变隔离开关

**为什么**：开关是命名空间注解（配置），列表是对象（事实）。把两者绑在同一个刷新里，会让「刷新列表」看起来像「重新应用隔离状态」，掩盖了两者不同的写入路径。

## 系统现状

老 console 的项目成员/角色/网络策略列表都有刷新；新 UI 此前没有。

## 仓库落点

- 页面：`settings/{NetworkIsolationPage,SettingsListPage}.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `networkpolicies:refresh`、`members:refresh`、`roles:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新保留搜索、排序、页码与项目筛选。
2. 刷新只重读列表查询。

## 已知坑

- 在 `<ResourceList\n` 之后插 prop 会吞掉下一行首字符（出现 `chema`），插入时要保留。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/project-settings/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01.yaml`

## 后续改进

- 与 R-27 一起评估轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01
