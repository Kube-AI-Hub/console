# 平台信息（L3）

[子模块需求](./_index.md)

## 概述

平台名称、平台描述、控制台地址三行。

## 用户故事

### US1 - 确认平台自称与控制台地址 (Priority: P1)

作为 **平台管理员**，我希望 **看到平台名称与控制台地址**，以便 **在分享链接或排查域名问题时有所依据**。

**Independent Test**：打开平台信息页，核对三行与 `kubesphere-config` 中 `console` 段的值一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01** — 已知平台配置可读，当打开平台信息页，则显示平台名称、平台描述、控制台地址三行；配置中缺少 `console` 段时三行显示 `-`。

## 设计目标

只读呈现，缺失即显式。

## 约束与边界

- 读 `kubesphere-system/kubesphere-config` 的 `kubesphere.yaml`，取 `console.title` / `console.desc` / `console.url`。

## UI 交互设计

定义列表三行。

## 文案与校验

- 属性名：平台名称、平台描述、控制台地址。
- 缺失值：`-`。

## 边界情况

- 没有 `console` 段：三行都是 `-`（目标集群即如此）。
- 值带引号：去掉首尾引号后显示。

## 明确不做

- 编辑平台信息。

## 假设

- 配置以单文件 YAML 存放。

## 验收用例

- `AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01** — 显示三行，缺失显示 `-`。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01** — 页面值与该 ConfigMap 内容一致。
