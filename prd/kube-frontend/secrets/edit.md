# 编辑保密字典（L3）

## 概述

同一份 Secret 有三种编辑入口，与老控制台一一对应：

| 入口 | 老控制台实现 | 能改什么 |
|---|---|---|
| 编辑信息 | `resource.baseinfo.edit` | 别名、描述（注解） |
| 编辑 YAML | `resource.yaml.edit` | 整个对象 |
| 编辑设置 | `secret.edit` → `SecretEditModal` | 按类型编辑 `data`（类型锁定） |

列表与详情都提供这三个入口，顺序一致。

## 用户故事

### US1 - 作为项目成员，改描述而不碰数据

**Independent Test**：对某条 Secret 打开「编辑信息」，改描述并确认；列表与详情的描述更新，`data` 不变。

### US2 - 作为项目成员，改用户名密码而不是重建对象

**Independent Test**：打开「编辑设置」，修改密码值并确认；详情里密码变为新值，用户名与类型保持不变。

### US3 - 作为项目成员，在类型不可知的对象上改 YAML

**Independent Test**：对 `kubernetes.io/ssh-auth` 类型的 Secret 打开「编辑设置」，界面说明该类型没有表单编辑器；打开「编辑 YAML」修改 `data` 并保存，对象更新。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SECRETS-EDIT-01** — Given 一条 Secret，When 打开「编辑信息」，Then 名称只读、别名与描述可改，且保存后对象上其他注解（创建者、kubesphere 标记、`is-default-class`）保持不变。
- **AC-L3-KUBE-FRONTEND-SECRETS-EDIT-02** — Given 一条用户名密码类型的 Secret，When 打开「编辑设置」，Then 类型选择器禁用并显示当前类型；修改密码后保存，`data.password` 更新而 `data.username`、`type` 不变；子表单展开时提交按钮禁用。
- **AC-L3-KUBE-FRONTEND-SECRETS-EDIT-03** — Given 打开「编辑 YAML」，When 把 `metadata.name` 改成别的名字，Then 提示「已有对象不支持改名，名称必须保持为 {name}。」且提交禁用；When 内容合法并提交，Then 对象被替换且弹窗关闭。

## 设计目标

- 三种编辑各自职责单一：信息只碰注解，设置只碰 `data`，YAML 碰整个对象。
- 编辑设置**不改类型**：上游按类型校验 `data`，在本页改类型几乎必然在提交时失败，还会把已填数据一起清掉。

## 约束与边界

- 编辑信息**合并**注解而不是替换：对象上还有 `kubernetes.io/service-account.name`、`kubesphere.io/creator` 等本对话框不展示的键。
- 编辑设置提交的是完整对象（先读当前对象拿 `resourceVersion` 再 PUT），不是补丁：这样 `data` 的增删是一次原子替换。
- 编辑 YAML 提交前先拉到当前 `resourceVersion`，避免 409。
- 未知类型：编辑设置给出说明，不提供通用键值编辑器（通用编辑器会覆盖掉该类型要求的结构）。
- 镜像仓库类型的编辑设置中，地址以 `http://` 开头才写 `force-insecure`，否则删除该注解。

## UI 交互设计

- 编辑信息弹窗：名称禁用输入框、别名、描述（多行），保存按钮在请求期间禁用。
- 编辑设置弹窗宽 `xl`，顶部类型选择器禁用；Opaque 类型为键值列表 + 内联子表单；其余类型为对应字段。
- 编辑 YAML 弹窗宽 `xl`，编辑区高 `52vh`，右下角上传/下载；底部错误信息优先显示提交期错误，其次解析错误。
- 保存成功关闭弹窗并刷新列表与详情。

## 文案与校验

- 标题：编辑信息、编辑设置、编辑 YAML。
- 校验：别名无效…／描述最长 256 个字符。／请设置键名。／键名只能包含字母、数字、-、_ 与 .／键名 {key} 重复，请使用唯一的键名。
- 未知类型说明：当前类型 {type} 没有对应的表单编辑器，请用「编辑 YAML」修改数据。

## 边界情况

- 键值对键名改成已存在的键：拒绝并提示重复（老控制台会静默覆盖另一条）。
- 键名含 `/`：拒绝；含 `.` 允许（键常是文件名）。
- 对象在编辑期间被他人修改：PUT 携带旧的 `resourceVersion` 得到 409，错误显示在弹窗上方。
- 值含中文：允许（以 UTF-8 编码保存）；界面给出提示，说明老控制台会拒绝这类值。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SECRETS-EDIT-01** — 编辑信息必须只改动别名与描述两个注解。
- **FR-L3-KUBE-FRONTEND-SECRETS-EDIT-02** — 编辑设置必须保持类型不变，并在子表单展开期间禁用提交。
- **FR-L3-KUBE-FRONTEND-SECRETS-EDIT-03** — 编辑 YAML 必须拒绝改名。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SECRETS-EDIT-01** — 编辑保存后 `kubectl get secret -o json` 的差异只包含用户改动的字段。

## 明确不做

- 不做类型的修改（走 YAML）。
- 不做版本历史与回滚。
- 不做「编辑信息」中的标签（labels）编辑。

## 假设

- 上游 PUT 需要 `resourceVersion`，kapis 的 GET 返回带资源版本的对象。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-02`
- `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-03`
