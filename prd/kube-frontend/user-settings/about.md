# 关于与版本（L3）

[子模块需求](./_index.md)

## 概述

右上角用户菜单里的「关于」回答两个问题：**这是什么平台**、**它运行在哪个版本上**。老 console 把入口放在用户菜单（`Layout/LoginInfo`），弹窗显示 logo、一行产品描述与 KubeSphere 版本（来自控制台服务端配置）。出问题时读者第一件想确认的往往就是版本。

## 用户故事

### US1 - 确认平台与版本 (Priority: P1)

作为 **任何登录用户**，我希望 **在用户菜单里打开「关于」看到平台名称、描述与控制台/Kubernetes 版本**，以便 **在报障或对版本时不必去翻部署清单**。

**Independent Test**：打开用户菜单点「关于」，弹窗显示平台名称（取平台配置，未配置时回退到「算力管理平台」）、描述、控制台版本与 Kubernetes 版本。

## 验收场景

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01** — 已知任意登录用户，当打开右上角用户菜单，则菜单里有「关于」；当点击它，则弹窗显示平台名称（来自平台配置 `kubesphere-config`，未配置时回退到默认名称）、平台描述（有配置时）、控制台版本与 Kubernetes 版本（来自 `/kapis/version` 的 `gitVersion` 与 `kubernetes.gitVersion`）；当版本接口不可用时，弹窗仍打开并显示「版本信息不可用」而不是空白或报错。

## 设计目标

1. 名称与描述读平台配置，部署改名后弹窗跟着变，不写死品牌。
2. 版本不可用不阻塞弹窗——「查版本」正是出问题时要做的事。

## 约束与边界

- 版本数据来自 `/kapis/version`；本地 BFF 返回 `v0.0.0`（harness 如实声明），页面原样显示，不替换成产品版本号。
- 关于弹窗只读，不提供任何写操作。
- 仅登录后可见（用户菜单只在已登录时渲染）。

## UI 交互设计

- 入口：右上角用户菜单，位于「用户设置」与「退出登录」之间。
- 弹窗：产品标记、名称、描述、两行版本信息；版本读取中显示骨架，失败显示说明。

## 文案与校验

| key | 中文 | 英文 |
| --- | --- | --- |
| `shell.about` | 关于 | About |
| `shell.aboutConsoleVersion` | 控制台版本 | Console version |
| `shell.aboutKubernetesVersion` | Kubernetes 版本 | Kubernetes version |
| `shell.aboutUnavailable` | 版本信息不可用。 | Version information is unavailable. |

- 无表单，不做输入校验。

## 边界情况

- 平台配置读取失败：名称回退默认值，描述省略，版本照常显示。
- 版本字段为空：该行显示 `-`。

## 假设

- `/kapis/version` 在真实集群与本地 BFF 上都可用（已在 B200 实测返回 `gitVersion` 与 `kubernetes.gitVersion`）。

## 明确不做

- 许可证/授权信息：当前部署不提供，老 console 也没有。
- 更新检查与升级入口：属运维动作，不在控制台内。

## 功能需求

- **FR-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01** — 用户菜单「关于」入口与版本弹窗。

## 成功标准

- **SC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01** — 弹窗显示的名称来自平台配置；两个版本与接口返回值一致。

## 验收用例

- TC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01
