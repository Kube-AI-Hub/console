# 服务账户详情与 kubeconfig · 技术方案（L3）

> 承接 [`prd/kube-frontend/serviceaccounts/detail.md`](../../../prd/kube-frontend/serviceaccounts/detail.md)。

## 概述

详情页读取 ServiceAccount，再用 `useServiceAccountSecrets` 按 `secrets[].name` 并行读取令牌 Secret，最后为每个令牌渲染一块：键值（默认遮挡）+ kubeconfig（只读、复制、下载）。kubeconfig 由纯函数 `buildKubeconfig()` 生成。

## 关联需求

- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-DETAIL-01`
- `AC-L3-KUBE_FRONTEND-SERVICEACCOUNTS-DETAIL-02`

## 设计目标与非目标

**目标**：kubeconfig 与原 Secret 严格对应且可直接使用；没有令牌时有解释；多个令牌互不影响。

**非目标**：生成令牌、编辑 kubeconfig、合并本地配置。

## 关键约束

- `token`：`data.token` 的 base64 解码值（兼容本身就是 JWT 的情况）。
- `certificate-authority-data`：`data['ca.crt']` 的**再编码**（kubeconfig 要求该字段本身是 base64 文本）；缺失时不输出该字段。
- `server` 固定 `https://kubernetes.default.svc:443`；`current-context` 与 cluster/user 名均为 `<sa>@local`。
- 每个令牌块的遮挡状态独立。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01 — kubeconfig 预览使用只读 `<pre>` 而不是 YAML 编辑器

**为什么**：kubeconfig 是生成物，用户不需要在这里编辑；只读文本可选中、可被智能体读取（`data-ai-id` 直接给出全文），也避免了 CodeMirror 在抽屉/弹窗中的高度计算问题。

**被否方案**：用 `YamlEditor` 只读模式。体积大（CodeMirror 约 500KB），且对只读内容没有额外价值。

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02 — 每个令牌一个块，状态互不共享

**为什么**：一个账户可能挂载多个令牌（历史遗留、迁移过渡），用户可能只想看其中一个。

**被否方案**：全局一个「显示明文」开关。一次点击会把所有令牌的明文同时展开，扩大泄露面。

### DEC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-03 — 复制失败不弹错误

**为什么**：非安全上下文（http 页面、部分内嵌浏览器）下 `navigator.clipboard` 不存在，`await` 会抛错。此时下载仍然可用，弹一个「复制失败」只会打断用户。

**被否方案**：失败时回退到 `document.execCommand('copy')`。该 API 已废弃且行为不稳定。

**何时重新考虑**：若用户报告在某些浏览器无法复制且不知可用下载，改为在按钮旁显示内联提示。

## 系统现状

老控制台 `ServiceAccounts/Detail/ServiceAccountDetail/Secret.jsx` 用同样的字段生成 kubeconfig 并提供复制/下载；本实现把生成逻辑抽成可单测的纯函数。

## 仓库落点

| 层 | 路径 |
|---|---|
| 路由 | `apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace.serviceaccounts.$name.tsx` |
| 数据区 | `apps/console-next/src/pages/serviceaccounts/ServiceAccountSecretsSection.tsx` |
| 纯函数 | `apps/console-next/src/lib/kubeconfig.ts` |
| 查询 | `apps/console-next/src/pages/serviceaccounts/queries.ts`（`useServiceAccountSecrets`） |

## 对外契约

`GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/{ns}/serviceaccounts/{name}` 与逐个 `GET .../secrets/{token}`。

## 不变量

- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01** — `buildKubeconfig()` 对同一输入始终产生同一文档（预览与下载一致）。
- **INV-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02** — 每个令牌块的明文默认不可见。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01** — `data.token` 解码后若为空（例如令牌 Secret 用 `stringData` 写入），`decodeToken()` 会返回原值；再拼接进 kubeconfig 后 `user.token` 为空，`kubectl` 报 `no credentials`。空态应明确指出。
  处置：`useServiceAccountSecrets` 返回的 Secret 若无 `token`，该块的 kubeconfig 仍生成但 `user.token` 为空，页面不额外拦截（数据如实反映）。
- **GOT-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02** — 令牌 Secret 请求失败时 `secrets.data[index]` 为 `undefined`，块内键值为空。
  处置：块标题仍显示 Secret 名称并给出加载/失败提示，不影响其余块。

## 测试与可观测

- 单元：`test/serviceaccounts-lib.test.ts` 断言 `buildKubeconfig` 的 `server`、`current-context`、`token` 解码、`ca` 再编码、缺 `ca` 时不输出字段。
- 端到端：`TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01..02`。

## 后续改进

若上游提供「创建 TokenRequest 子资源」的 kapis 入口，可在详情页提供「生成新令牌」——本期不做。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02`
