# 关于与版本 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/user-settings/about.md)

## 概述

`shell/AboutDialog.tsx`：两个只读查询（平台配置 + 版本），入口在 `AppShell` 的用户菜单。

## 关联需求

- AC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01

## 设计目标与非目标

目标：登录用户随时看到平台名称与版本。非目标：许可证、升级入口。

## 关键约束

- 名称/描述读平台 ConfigMap（`kubesphere-config` 的 `console:` 段），与「平台信息」页同源，避免两处显示不同名字。
- 版本读 `/kapis/version`：`gitVersion` 与控制台产品版本同源，`kubernetes.gitVersion` 是集群版本。
- 查询在弹窗打开时才启用（`enabled: open`），避免每个页面都多两个请求；`staleTime` 10 分钟。

## 方案决策

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01 — 版本接口失败不阻塞弹窗

**为什么**：读者点「关于」往往是因为出了问题；一个因接口失败而显示空白/报错的弹窗，恰好丢掉了最需要的信息（平台是谁、跑在哪）。因此失败时降级为「版本信息不可用」，名称与描述照常显示。

### DEC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-02 — 原样显示 `v0.0.0`

**为什么**：本地 harness 返回 `v0.0.0` 是它如实声明；把它替换成产品版本号会让读者以为在跑正式版本。显示真实返回值，问题留在真实处。

## 系统现状

老 console 在用户菜单有「关于」（`Modals/About`），显示 logo、描述与 KubeSphere 版本；新 UI 此前没有该入口。

## 仓库落点

- 组件：`apps/console-next/src/shell/AboutDialog.tsx`
- 入口：`apps/console-next/src/shell/AppShell.tsx`（用户菜单）
- 契约：`packages/api-client/src/cluster.ts`（`versionApi`）

## 对外契约

| 用途 | 路径 / 句柄 |
| --- | --- |
| 版本 | GET /kapis/version |
| 入口 | `shell:about` |
| 弹窗 | `shell-about:surface` / `:title` / `:description` / `:console-version` / `:kubernetes-version` / `:unavailable` |

## 不变量

1. 名称/描述与「平台信息」页同源。
2. 版本不可用时弹窗仍可读。

## 已知坑

- `/api/v1/version` 与 `/version` 都返回 404，只有 `/kapis/version` 可用。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/user-settings/TC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01.yaml`

## 后续改进

- 显示构建时间与提交号（`buildDate`/`gitCommit`），便于对版本。

## 验收用例

- TC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01
