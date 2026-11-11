# 编辑保密字典 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/edit.md`](../../../prd/kube-frontend/secrets/edit.md)。

## 概述

三个入口复用三个组件：共享 `EditInfoDialog`（别名/描述）、`SecretEditSettingsDialog`（按类型的 `data`）、共享 `YamlDialog`（整对象）。页面在打开前先 `GET` 详情，避免用列表摘要打开编辑弹窗。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-EDIT-01`
- `AC-L3-KUBE-FRONTEND-SECRETS-EDIT-02`
- `AC-L3-KUBE-FRONTEND-SECRETS-EDIT-03`

## 设计目标与非目标

**目标**：三种编辑各自动最小字段；不因为一次保存丢失用户没看到的注解；409 可解释。

**非目标**：改类型、版本历史、labels 编辑。

## 关键约束

- 编辑信息：合并注解后调用**替换**（`PUT`）——共享 `EditInfoDialog` 只输出注解映射，页面把它合进 `raw.metadata`。
- 编辑设置：类型锁定，提交 `{ ...raw, data }`。
- 编辑 YAML：提交解析后的对象；`lockName` 阻止改名。
- 所有替换路径都先读取当前对象取 `resourceVersion`（`resourceApi.update`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-EDIT-01 — 编辑信息走整对象 PUT，而不是注解 PATCH

**为什么**：`EditInfoDialog` 是三个资源共用的，输出的是完整注解映射（它自己合并了未展示的键）。用 PATCH 只需发 `metadata.annotations`，但 PATCH 的合并语义（RFC 7386）对「删除某个注解」不友好——把键设为 `null` 才会删除，而表单清空时我们希望删除键。PUT 携带完整注解映射，语义最直接。

**被否方案**：PATCH + `null` 删除。需要每个调用点记得把空值转换成 `null`，一旦漏掉就会留下空字符串注解，列表里显示空别名。

**何时重新考虑**：若两个用户同时编辑不同注解，PUT 会互相覆盖。届时改为 PATCH，并把「清空 = `null`」的规则收进 `metadataAnnotations`。

### DEC-L3-KUBE-FRONTEND-SECRETS-EDIT-02 — 编辑设置禁用类型选择器

**为什么**：见 L2 技术方案中「编辑设置锁定类型」的决策：上游按类型校验 `data`，换类型通常会被拒绝，而数据已经被清空。

**被否方案**：允许改类型并在提交前按新类型重新校验。用户仍会丢失已填数据，且失败信息出现在点击「确认」之后。

## 系统现状

老控制台 `secret.edit` 打开 `SecretEditModal`（`disableSelect`），`resource.baseinfo.edit` 打开通用信息弹窗，`resource.yaml.edit` 打开 YAML 编辑器；三者与新实现一一对应。

## 仓库落点

| 层 | 路径 |
|---|---|
| 信息弹窗 | `apps/console-next/src/components/resource/EditInfoDialog.tsx` |
| 设置弹窗 | `apps/console-next/src/pages/secrets/SecretEditDialogs.tsx` |
| YAML 弹窗 | `apps/console-next/src/components/resource/YamlDialog.tsx` |
| 替换请求 | `packages/api-client/src/resources.ts`（`update`） |
| 页面装配 | `apps/console-next/src/pages/secrets/SecretsPage.tsx`、`routes/...secrets.$name.tsx` |

## 对外契约

`PUT /api/v1/namespaces/{ns}/secrets/{name}`，body 为完整对象且 `metadata.resourceVersion` 为最新值。

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-EDIT-01** — 编辑信息保存后，除 `kubesphere.io/alias-name` 与 `kubesphere.io/description` 外的注解逐字不变。
- **INV-L3-KUBE-FRONTEND-SECRETS-EDIT-02** — 编辑设置保存后 `type` 与 `metadata` 不变，只有 `data` 变化。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-EDIT-01** — 从列表行打开编辑时若直接使用列表摘要（没有 `data`），空编辑器保存会把数据清空。
  处置：页面先 `GET` 详情再打开弹窗（`openWithDetail`）。
- **GOT-L3-KUBE-FRONTEND-SECRETS-EDIT-02** — 子表单打开时点「确认」会把未保存的键值对丢掉。
  处置：`SecretSettingsEditor` 通过 `onEditingChange` 通知宿主禁用提交。

## 测试与可观测

- 单元：`test/secrets-page.test.tsx`（类型禁用、子表单禁用提交、YAML 改名被拒）。
- 端到端：`TC-L3-KUBE-FRONTEND-SECRETS-EDIT-01..03`。

## 后续改进

并发编辑的冲突提示（403/409 的具体文案）可与服务账户页一起做。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-02`
- `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-03`
