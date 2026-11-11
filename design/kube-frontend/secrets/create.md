# 创建保密字典 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/create.md`](../../../prd/kube-frontend/secrets/create.md)。

## 概述

`SecretCreateDialog` 管理两步状态（`Step = 'basic' | 'data'`）与一份 `Draft`（名称、别名、描述、项目、类型、`data`、`annotations`、`isDefault`）。数据设置调用 `SecretSettingsEditor`，YAML 模式调用共享 `YamlDialog`，初始文档由 `Draft` 生成。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-CREATE-01`
- `AC-L3-KUBE-FRONTEND-SECRETS-CREATE-02`
- `AC-L3-KUBE-FRONTEND-SECRETS-CREATE-03`

## 设计目标与非目标

**目标**：所有可预判的错误（名称格式、重名、必填数据、镜像仓库不完整）在提交前暴露；表单与 YAML 两种模式共享同一份草稿。

**非目标**：labels 输入、从文件导入、多 registry 图形编辑。

## 关键约束

- 名称规则 `/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/`，最长 63；与 kube-apiserver 的 DNS-1123 label 规则一致（老控制台 `PATTERN_NAME`）。
- 必填数据由类型表 `REQUIRED_KEYS` 驱动：TLS 需 `tls.crt`、`tls.key`；basic-auth 需 `username`、`password`；dockerconfigjson 需 `.dockerconfigjson`。
- 重名检查走 `/api/v1` 的 GET（`checkName`），按**所选项目**判定。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-CREATE-01 — 「设为默认」随对象一起创建，不额外并发清旧项

**为什么**：新建对象时，旧默认项的清理由「设为默认」动作（详情页）或下一个「设为默认」操作负责，不在创建路径里做第二次写。创建是用户最期待「一次成功」的动作，多一次 PATCH 意味着多一种失败组合。

**被否方案**：创建时如勾选默认，先找旧默认项清掉。老控制台在 `secret.create` 里确实调用了 `clearDefault`；但它是在 `store.create(...).then(...)` **之前** `await` 的，若创建随后失败，旧默认已经被清掉，用户会得到一个没有默认仓库的项目。新前端把顺序反过来：创建成功后再清旧项（由详情页的「设为默认」承担这一步，或由后续动作覆盖）。

**何时重新考虑**：用户反馈「新建时勾选默认但旧项仍显示默认」时，在创建成功后追加异步清理（失败不影响创建结果）。

### DEC-L3-KUBE-FRONTEND-SECRETS-CREATE-02 — 切换类型清空数据，而不是尝试转换

**为什么**：四种类型的 `data` 形状互不兼容（TLS 的键是 `tls.crt`，basic-auth 是 `username`），保留旧键会让提交必然失败。清空是唯一正确行为，但必须**告知**：界面在类型下方常驻「切换类型会清空已填写的数据」。

**被否方案**：切换类型时保留键值，让用户自己删。上游会以 422 拒绝，且错误信息只指出一个键，用户需要反复试错。

### DEC-L3-KUBE-FRONTEND-SECRETS-CREATE-03 — YAML 模式用同一份 Draft 生成初始文档

**为什么**：配置字典已验证「两种模式互不丢失」。`SecretCreateDialog` 在切换时用 `toYaml(template)` 由当前草稿生成文档，`data` 保持 base64（与存储一致），切换回来时不会把 base64 当成明文再编码一次。

**被否方案**：YAML 模式从空白开始。会丢掉用户刚填的名称与项目，最常被抱怨的一点。

**何时重新考虑**：当用户希望 YAML 里写明文（`stringData`）时，需要增加一次「识别 `stringData` 并编码」的转换。

### DEC-L3-KUBE-FRONTEND-SECRETS-CREATE-04 — 镜像仓库地址带 `http://` 时自动写 `force-insecure`

**为什么**：与老控制台 `handleAnnotationsByUrl` 一致：协议是唯一可靠的「是否需要跳过证书校验」信号，让用户另勾一个复选框会产生与地址不一致的组合。

**被否方案**：提供独立的「跳过 TLS 校验」开关。用户会勾选它却填 `https://`，拉取时仍会因证书失败，排查成本更高。

## 系统现状

老控制台创建弹窗（`components/Modals/Create` + `configs/steps/secrets.js`）是两步；数据设置（`components/Forms/Secret/SecretSettings`）按类型分派，与本文的结构一致。

## 仓库落点

| 层 | 路径 |
|---|---|
| 弹窗 | `apps/console-next/src/pages/secrets/SecretCreateDialog.tsx` |
| 数据设置 | `apps/console-next/src/pages/secrets/SecretSettingsEditor.tsx` |
| 类型表 | `apps/console-next/src/pages/secrets/secretTypes.ts` |
| 提交映射 | `packages/api-client/src/secrets.ts`（`toKubeSecret`） |
| 请求 | `apps/console-next/src/pages/secrets/queries.ts`（`useCreateSecret`） |

## 对外契约

`POST /api/v1/namespaces/{ns}/secrets`，body：

```json
{
  "apiVersion": "v1",
  "kind": "Secret",
  "metadata": { "name": "...", "namespace": "...", "annotations": { "kubesphere.io/alias-name": "...", "kubesphere.io/description": "...", "secret.kubesphere.io/force-insecure": "true" } },
  "type": "kubernetes.io/dockerconfigjson",
  "data": { ".dockerconfigjson": "<base64>" }
}
```

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-CREATE-01** — 提交的 `data` 全部是 base64；表单里输入的是明文。
- **INV-L3-KUBE-FRONTEND-SECRETS-CREATE-02** — 类型要求的字段缺失时请求不会发出。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-CREATE-01** — 名称唯一性检查若用列表接口（`GET .../secrets?name=x`）会因前缀匹配误判重名（`x` 与 `x2`）。
  处置：`checkName` 走 `GET /api/v1/.../secrets/{name}`，404 才视为可用。
- **GOT-L3-KUBE-FRONTEND-SECRETS-CREATE-02** — 名称检查失败（网络）时若直接 `throw`，用户会卡在「下一步」没反应。
  处置：检查失败不阻塞（PRD 边界情况），提交时由上游错误呈现。
- **GOT-L3-KUBE-FRONTEND-SECRETS-CREATE-03** — `tls.crt` 字段在 52vh 弹窗里可能很长，`Textarea` 不限高会撑破弹窗。
  处置：固定 `rows={6}`，由浏览器滚动。

## 测试与可观测

- 单元：`test/secrets-page.test.tsx` 覆盖名称校验、重名提示、必填数据、类型切换清空、`force-insecure` 写入。
- 端到端：`TC-L3-KUBE-FRONTEND-SECRETS-CREATE-01..03`。

## 后续改进

多 registry 的图形编辑；`stringData` 输入模式。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-02`
- `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-03`
