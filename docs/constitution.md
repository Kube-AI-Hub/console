# 智算平台 · 架构宪法

> **跨功能都不得违反的架构铁律。** 唯一正文在本文件。
>
> - `prd/`、`design/` **引用本文件，不复制条款。** 改实现不用改这里。
> - 改本文件等于改法律，需要评审。不要为了让某次实现过关而放宽条款。

| 条款 | 铁律 |
|------|------|
| **C1** | 前端只经 `src/utils/request.js` 访问 `/kapis`；后端接口只在 `kube-server/pkg/kapis/<group>` 注册，不在页面里直连 Prometheus 或 kube-apiserver |
| **C2** | 生成物不手改：`prd/catalog.yaml`、`tests/ui/cases/**`、`tests/ui/cases/_traceability.md` |
| **C3** | 页面颜色只取 `src/scss/variables.scss` 的语义 token；页面 SCSS 不写十六进制色值 |
| **C4** | 指标只经 `monitoring.kubesphere.io/v1alpha3`；新指标名必须登记在 `kube-server/pkg/models/monitoring/named_metrics.go`，并在 `prometheus/promql.go` 有对应模板 |
| **C5** | 前后端契约按 kapis group 版本化（如 `juicefs.kubesphere.io/v1alpha1`）；改字段要同时改 design 的 `CON-*` 与用例 |

---

## C1. 分层与数据来源

前端页面不直接调用 `fetch`，统一走 `src/utils/request.js`（自动带 token、统一错误）。后端沿用 `kube-server` 的 `handler → component → builder` 方向，新能力以 `pkg/kapis/<group>/v1alpha1` 的形式注册，并在 `pkg/apiserver/apiserver.go` 的注册区加一行。

页面需要的新数据，要么来自已有的 kapis（k8s 资源、monitoring），要么新增一个 group；不要在页面里拼 kube-apiserver 的原始路径。

## C2. 生成物

下列文件由工具生成，**不手改**：

- `prd/catalog.yaml`（`prd/tools/build_prd.py`）
- `tests/ui/cases/**/*.md`、`tests/ui/cases/_traceability.md`（`tests/ui/generate_case_docs.py`）

## C3. 主题色

控制台是深色主题：页面底 `#14215a`、卡片 `#4a5aa2`。**任何页面都不写十六进制色值**，一律用 `src/scss/variables.scss` 的语义 token：

| 用途 | token |
|------|-------|
| 主要文字 | `$dark`（`#deebf6`） |
| 次要文字 | `$second-text-color` / `$dark-grey` |
| 第三级文字 | `$third-text-color` |
| 卡片 / 面板底 | `$lightest` / `$light` |
| 分隔线 | `$border-color` / `$second-border-color` |
| 进度条底色 | `$light-color04` |
| 强调 | `$primary` / `$sub` / `$warning` / `$danger` |

理由：写死浅色主题的 `#242e42` 在卡片底上只有 **2.12:1**，`#79879c` 只有 **1.76:1**，正文不可读。用 token 后分别是 **5.29:1** 与 **3.97:1**。门禁与 UI 用例都会检查对比度 ≥ 4.5:1。

浅底提示条（如 info alert）可以保留浅底深字，但底色与文字也必须成对取自 token，不能只改一半。

## C4. 指标

- 只经 `kapis/monitoring.kubesphere.io/v1alpha3`（或其 cluster 前缀形式）查询，页面不直连 Prometheus。
- 新指标要三步齐全：`named_metrics.go` 登记名字、`promql.go` 加模板、design 里写单位与语义。
- **单位必须与数据一致**：字节速率为 `throughput`（B/s），延迟为 `second`（s/ms），比率为 `%`。`bandwidth` 是按 bit 换算的，只用于网络链路。

## C5. 契约版本化

一个 kapis group 就是一个对外契约。改字段、改语义、改默认值，都要在 design 的 `CON-*` 里写清新旧行为与兼容方式，并在用例里覆盖旧字段不再被使用。不要在页面里对同一字段做两套解释。
