# 保密字典列表（L3）

## 概述

保密字典页的主表格：列、类型显示、字段数、排序与分页。搜索、详情与增删改各有自己的文档。

老控制台同一页面是 `pages/projects/containers/Secrets/index.jsx`：名称列用 `Avatar`（别名替换名称，第二行描述）、类型列把 `SECRET_TYPES` 里的四类翻成中文、字段数列是 `Object.keys(data).length`、创建时间列 `YYYY-MM-DD HH:mm:ss`。本页逐项照搬，只增加一个「项目」列（列表可以跨项目看）与一个「默认仓库」徽标。

## 用户故事

### US1 - 作为项目成员，看清每条 Secret 的类型与规模

**Independent Test**：打开列表，读出一条 TLS 类型的 Secret：类型列显示「TLS 信息」，字段数为 2；`Opaque` 类型的显示「默认」。

### US2 - 作为项目成员，按最近创建排序并翻页

**Independent Test**：默认按创建时间倒序，最新一条在最前；点击「名称」列头切换到按名称升序；点「下一页」后回到第 1 页顶部的选择被清空。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SECRETS-LIST-01** — Given 项目内有多条 Secret，When 打开列表，Then 每行显示名称（别名替换名称，第二行为描述或 `-`）、项目、类型、字段数、创建时间；`Opaque` 显示「默认」，`kubernetes.io/tls` 显示「TLS 信息」，`kubernetes.io/dockerconfigjson` 显示「镜像仓库信息」，`kubernetes.io/basic-auth` 显示「用户名和密码」，其他类型原样显示。
- **AC-L3-KUBE-FRONTEND-SECRETS-LIST-02** — Given 列表已加载，When 点击「创建时间」列头，Then 请求带上 `sortBy=createTime` 与取反的 `ascending`，页码回到第 1 页；当点击分页切到第 2 页时，已选项被清空。

## 设计目标

- 类型是这一页最该一眼看到的信息：它决定了这条 Secret 能不能被某个工作负载正确使用。
- 字段数只给数量，不给键名：Secret 的键名常常直接暴露用途（`password`、`token`），而列表会被截图、被共享。

## 约束与边界

- 列的可见性按断点折叠：`fieldCount` 在 `md` 以下隐藏，`type`/`createTime` 在 `lg` 以下隐藏，`project` 只在 `xl` 以上显示。
- 分页固定每页 10 条，服务端切片（`page`/`limit`，总数取 `totalItems`）。
- 类型列按存储的类型取值；`type` 为空时按 kube-apiserver 的默认值显示「默认」。

## UI 交互设计

- 名称列两行：第一行别名（无别名时名称），悬停显示真实名称；第二行描述，缺失为 `-`。
- 默认镜像仓库在名称后追加「默认仓库」徽标，不改变名称本身。
- 联邦对象追加「联邦」徽标。

## 文案与校验

- 表头：名称、项目、类型、字段数、创建时间、操作。
- 类型：默认 / TLS 信息 / 镜像仓库信息 / 用户名和密码 / 服务账户令牌。

## 边界情况

- 空项目：空态「暂无保密字典」，不渲染表头。
- 名称很长：名称列截断，悬停看全称。
- 类型列宽度固定 180px，未知类型（如 `kubernetes.io/ssh-auth`）以原字符串显示并截断。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SECRETS-LIST-01** — 列表必须按类型给出中文名（四种已知类型）或原字符串。
- **FR-L3-KUBE-FRONTEND-SECRETS-LIST-02** — 名称与创建时间两列必须可排序，排序与分页由服务端完成。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SECRETS-LIST-01** — 列表里的名称集合与 `kubectl get secrets -n <ns>` 一致，类型与字段数与 `kubectl get secret -o json` 一致。

## 明确不做

- 不做列显隐设置与列宽拖拽。
- 不在列表显示键名或任何值。

## 假设

- `totalItems` 是切片前的总数；上游缺失时退回 `total_count`。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-LIST-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-LIST-02`
