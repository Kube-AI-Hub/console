# 创建保密字典（L3）

## 概述

创建入口在列表工具栏的主按钮。两步表单（基本信息 / 数据设置）+ YAML 模式，与老控制台的创建弹窗（`configs/steps/secrets.js`：基本信息、数据设置）一致。第二步按所选**类型**切换编辑器。

## 用户故事

### US1 - 作为项目成员，从表单创建一条普通（Opaque）凭据

**Independent Test**：创建 → 名称 `app-secret` → 下一步 → 添加键 `password`、值任意 → 创建；列表出现 `app-secret`，详情一条键值。

### US2 - 作为项目成员，创建一条 TLS 证书

**Independent Test**：创建 → 名称 → 下一步 → 类型选「TLS 信息」→ 填证书与私钥 → 创建；`kubectl get secret -o json` 的 `data` 恰有 `tls.crt`、`tls.key`。

### US3 - 作为项目成员，粘贴一份现成的 YAML 创建

**Independent Test**：创建 → 切到 YAML 模式 → 粘贴含 `type: kubernetes.io/basic-auth` 与 `data` 的对象 → 提交；对象按 YAML 内容创建。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SECRETS-CREATE-01** — Given 创建弹窗已打开，When 名称留空、含大写、以连字符开头或超过 63 字符，Then 提示对应错误且不进入第二步；When 名称与同项目已有对象重复，Then 提示「名称已存在，请输入其他名称。」；When 选择另一个项目，Then 对象创建到所选项目。
- **AC-L3-KUBE-FRONTEND-SECRETS-CREATE-02** — Given 进入数据设置并选类型「用户名和密码」，When 用户名或密码为空，Then 提交被拒绝并提示必填；When 两项都填，Then 提交后弹窗关闭、列表出现该对象，且其 `data.username`、`data.password` 解码后与输入一致（含中文与特殊字符）。
- **AC-L3-KUBE-FRONTEND-SECRETS-CREATE-03** — Given 在数据设置中切换到其他类型，Then 已填数据被清空并显示「切换类型会清空已填写的数据」；Given 切到 YAML 模式，Then 表单已填的内容（名称、别名、描述、类型、数据）出现在初始文档中。

## 设计目标

- 每种类型只露出该类型需要的字段，减少「填了却被 API 拒绝」。
- 值一律以明文编辑、在边界编码，避免让用户自己处理 Base64。
- 提交前的错误（名称格式、重名、必填项）都要在点击「创建」之前暴露。

## 约束与边界

- 名称规则与 kube-apiserver 一致：小写字母、数字、连字符，首尾为字母或数字，最长 63。
- 别名允许中文、字母、数字与内部连字符，不能以连字符开头/结尾；描述最长 256。
- 项目默认取列表当前筛选（「全部项目」时取路由项目），可改；改项目后重名检查针对新项目。
- 镜像仓库地址以 `http://` 开头时自动写入注解 `secret.kubesphere.io/force-insecure: "true"`；切回 `https://` 时移除该注解。
- 勾选「设为默认镜像仓库」写入 `secret.kubesphere.io/is-default-class: "true"`。
- YAML 模式提交与表单模式同一端点（`POST /api/v1/namespaces/{ns}/secrets`），YAML 中的 `metadata.namespace` 优先。
- 老控制台的 `mix(salt, base64(pw))` 密码加密**不迁移**：它可逆且会让含 `@` 的密码变成非法密文，与配置字典的同类决策一致。

## UI 交互设计

- 弹窗宽 `xl`，步骤用序号圆点；「上一步」只在第二步出现。
- 数据区（Opaque）沿用「列表 + 内联子表单」：添加与编辑都在原地展开，子表单打开期间主提交禁用。
- 类型选择器在第二步顶部；编辑模式下不可改（见 `edit`）。
- YAML 模式与表单模式互不丢失：切过去带着已填内容，切回来保留。

## 文案与校验

- 标题：创建保密字典。步骤：基本信息、数据设置。按钮：下一步、上一步、创建、取消、编辑 YAML。
- 校验：请设置一个名称。／名称无效…／名称已存在，请输入其他名称。／请选择项目。／别名无效…／此项为必填。／请填写当前类型要求的数据项。
- 提示：切换类型会清空已填写的数据。

## 边界情况

- 重名检查失败（网络问题）：不阻塞进入下一步，由提交时的上游错误呈现。
- 镜像仓库只填一部分：提交被拒并提示「请填写镜像仓库地址、用户名与密码。」。
- 数据为空且类型为 Opaque：允许创建（空 Secret 合法）。
- YAML 无法解析：提交按钮禁用并提示「YAML 格式有误，请修正后再提交。」。
- 提交过程中重复点击：按钮在请求期间禁用。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SECRETS-CREATE-01** — 名称、别名、描述、项目必须在进入下一步前完成校验，重名按项目判定。
- **FR-L3-KUBE-FRONTEND-SECRETS-CREATE-02** — 类型要求的字段缺失时必须阻止提交。
- **FR-L3-KUBE-FRONTEND-SECRETS-CREATE-03** — 表单与 YAML 提交到同一端点，成功后关闭弹窗并刷新列表。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SECRETS-CREATE-01** — 创建后 `kubectl get secret <name> -o json` 的 `type`、`data` 与表单一致，`data` 各值解码后与输入逐字相同。

## 明确不做

- 不做 labels 输入（走 YAML）。
- 不做从文件导入证书或 `.dockerconfigjson`（可粘贴内容）。
- 不做多条目镜像仓库的图形编辑（编辑器只维护一个 registry，其余走 YAML）。
- 不做服务账户令牌类型的手动创建。

## 假设

- 选择「设为默认镜像仓库」时若已有默认项，由服务端不强制互斥；本页在新对象创建成功后再清旧项（见设计 DEC）。
- 目标项目默认为当前路由的项目。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-02`
- `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-03`
