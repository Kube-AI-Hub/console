# 迁移计划：保密字典（Secrets）与 服务账户（ServiceAccounts）

> 目标仓库：`console/kube-frontend`（Apache-2.0）。参照对象：已迁移的配置字典（ConfigMaps）。
> 依据：`console/docs/legacy-ui-migration-guide.md`（迁移方法）、`console/docs/SDD.md`（文档闭环）、`环境/a100环境.md`（目标环境）。

## 0. 环境现状（前置于本计划）

| 项 | 状态 |
|---|---|
| A100 `ks-apiserver` | **本会话中发现其处于 `CrashLoopBackOff`**（与迁移无关）：`kubesphere-config` 被 `kubectl-patch` 改成 `authenticateRateLimiterMaxTries: 1000`，大于 `loginHistoryMaximumEntries` 默认值，新版 `ks-apiserver` 启动校验失败；最后一次 controller 自愈回滚把旧 RS `65fd5d4cdb` 重新启用，于是全部版本都在同一配置上崩溃。已把两项恢复为 `10m0s` / `10` 并重启，现 `Running 1/1`；证据保存在 a100 `/root/ks-apiserver-incident-20261111.txt`，原 ConfigMap 备份 `/tmp/kubesphere.yaml.bak`。 |
| 本地 BFF | `http://127.0.0.1:8091`，登录 `admin` / `P@88w0rd`，已验证可用 |
| 前端 | `http://localhost:5174`（vite dev，已运行） |

后续所有真实环境验证都走 BFF，避免再次因误输密码触发认证限流。

## 1. 迁移范围与方法

以**旧源码**为准（不看截图推断），逐个页面比对；每个差异判定为「照搬 / 改进 / 不迁移」并写进设计文档。

### 1.1 保密字典 Secret

| 页面 | 旧源码 | 新落点 |
|---|---|---|
| 列表 | `pages/projects/containers/Secrets/index.jsx` | `pages/secrets/SecretsPage.tsx` |
| 详情 | `.../Secrets/Detail/index.jsx` + `SecretDetail/index.jsx` | `routes/...secrets.$name.tsx` |
| 创建 | `configs/steps/secrets.js`、`components/Forms/Secrets/SecretSettings/**` | `pages/secrets/SecretCreateDialog.tsx`、`SecretSettingsEditor.tsx` |
| 编辑信息/YAML | `resource.baseinfo.edit`、`resource.yaml.edit` | `SecretEditDialogs.tsx`、`SecretYamlDialog`（复用通用 YAML 弹窗） |
| 编辑设置 | `secret.edit` → `Modals/SecretEdit` | `SecretSettingsEditor` 置于 edit 弹窗 |
| 删除 | `resource.delete` / `resource.batch.delete` | `SecretDeleteDialog`（复用通用删除弹窗逻辑） |
| 设为默认仓库 | `secret.default` → `SetDefaultSecretClass` | 详情行操作 + 注释 patch |

行为要点（必须照搬）：列（名称/别名+描述两行、类型、字段数、创建时间）、行操作顺序（编辑信息 → 编辑 YAML → 编辑设置 →（设为默认仓库，仅 dockerconfigjson 且非默认）→ 删除）、类型中文映射（Opaque→默认、TLS→TLS 信息、dockerconfigjson→镜像仓库信息、basic-auth→用户名和密码）、四种类型各自的设置界面、详情遮蔽/明文切换、`safeBtoa/safeAtob`（UTF-8 Base64）、dockerconfigjson 的 `force-insecure` 注释联动、TLS/basic-auth 字段、设为默认时的互斥清除。

应当改进：改名检测、重复键、密钥值默认遮挡、`dockerconfigjson` 结构非法时不崩。

不迁移：`mix(salt, base64(pw))` 密码加密（同配置字典的 DEC，服务端接受明文）；镜像仓库密钥「验证」按钮依赖 `registrysecrets/{name}/verify` 且需要已存在的对象，创建阶段不可用 → 改为保存后提示，或保留但明确 disabled 的条件（见 DEC）。

### 1.2 服务账户 ServiceAccount

| 页面 | 旧源码 | 新落点 |
|---|---|---|
| 列表 | `pages/projects/containers/ServiceAccounts/index.jsx` | `pages/serviceaccounts/ServiceAccountsPage.tsx` |
| 详情（含 kubeconfig） | `.../ServiceAccounts/Detail/**`（`Secret.jsx` 生成 kubeconfig） | `routes/...serviceaccounts.$name.tsx`、`ServiceAccountSecretsSection.tsx` |
| 创建 | `configs/steps/serviceaccounts.js`、`Forms/ServiceAccount/BaseInfo` | `ServiceAccountCreateDialog.tsx` |
| 编辑信息 | `Modals/EditServiceAccount` | `ServiceAccountEditDialogs.tsx` |
| 修改角色 | `Modals/ModifyServiceAccountRole`、`Inputs/RoleSelect` | 同文件 `ServiceAccountRoleDialog` + `roles` 查询 |
| 编辑 YAML / 删除 | `resource.yaml.edit` / `resource.delete` | 复用通用弹窗 |

行为要点：列（名称+描述、角色、密钥（可链接到保密字典详情）、创建时间）；行操作（编辑 → 编辑 YAML → 修改角色 → 删除）；详情属性（集群、项目、角色、创建时间、创建者）；详情数据区按 `secrets[]` 逐个取 Secret 展示 `加密显示/明文` 与 kubeconfig（复制、下载 `kubeconfig.yaml`）；角色来自注解 `iam.kubesphere.io/role`，可选值来自 `kapis/iam.kubesphere.io/v1alpha2/namespaces/{ns}/roles`。

## 2. 技术方案（统一抽象）

配置字典的 DEC-LIST-02 写明「抽公共抽象等第二个使用者出现」。现在出现了**第三、第四个**使用者（Secrts、ServiceAccounts），且两个新资源与 ConfigMap 的差异只在于「类型字段、数据语义、额外操作」。

- 新增 `packages/api-client/src/resources.ts`：一份通用 `resourceApi`（kapis 读 / `/api/v1` 写、`page/limit/sortBy/ascending/name`、`resourceVersion` 回填、merge-patch、批量删除），`secrets`/`serviceaccounts` 各包一层类型化 API。ConfigMaps 保持现状不动（避免回归），新代码不复制其 300 行。
- 新增 `apps/console-next/src/components/resource/`：`DeleteDialog`（类型化确认）、`YamlDialog`（通用）、`EditInfoDialog`（别名/描述通用）、`ResourceErrorPanel`、`ResourcePageShell`（四态 + 错误出口）。ConfigMaps **不在本次重构**（避免破坏已完成用例），新页面复用新抽象。
- 通用逻辑抽到 `packages/ui` 之外的应用层 `src/lib/`：`base64.ts`（UTF-8 安全的 btoa/atob）、`dockerconfig.ts`（解析/生成 `.dockerconfigjson`）、`kubeconfig.ts`（按旧 `Secret.jsx` 规则生成）、`format.ts`（沿用已验证的 `YYYY-MM-DD HH:mm:ss`）。共享模块只写一次，列表与详情都用它。

## 3. 文件清单（预计新增）

```
kube-frontend/packages/api-client/src/
  resources.ts            # 通用 kapis/kube 资源 API
  secrets.ts              # Secret 类型、映射、输入、dockerconfigjson 辅助
  serviceaccounts.ts      # ServiceAccount 类型、映射、role 注解、roles 列表
kube-frontend/packages/api-client/src/index.ts        # 导出
kube-frontend/packages/locales/src/index.ts           # zh/en 文案
kube-frontend/apps/console-next/src/lib/              # base64 / dockerconfig / kubeconfig / time
kube-frontend/apps/console-next/src/components/resource/  # 通用弹窗与错误面板
kube-frontend/apps/console-next/src/pages/secrets/*        # 页面与弹窗
kube-frontend/apps/console-next/src/pages/serviceaccounts/*
kube-frontend/apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace.secrets.tsx
kube-frontend/apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace.secrets.$name.tsx
kube-frontend/apps/console-next/src/routes/...serviceaccounts.tsx / ...serviceaccounts.$name.tsx
kube-frontend/apps/console-next/src/shell/AppShell.tsx   # 侧栏新增「保密字典」「服务账户」
```

文档：`prd/kube-frontend/{secrets,serviceaccounts}/`、`design/kube-frontend/{secrets,serviceaccounts}/`、`prd/tools/tree.py`。
用例：`tests/ui/specs/kube-frontend/{secrets,serviceaccounts}/TC-*.yaml` + `tests/ui/tests/...` + `pages/secrets.py`、`pages/serviceaccounts.py`、conftest fixtures。

功能点（每个 L3 一份 PRD + DESIGN + ≥1 用例）：
- secrets：`list`、`search`、`detail`、`create`、`edit`、`delete`、`ai-surface`、`mobile`
- serviceaccounts：`list`、`search`、`detail`、`create`、`edit`、`role`、`delete`、`ai-surface`、`mobile`

## 4. 执行顺序

1. 功能树（`tree.py`）→ `build_prd.py` 生成骨架。
2. `api-client`：通用资源 API + 两个资源模块 + 单测。
3. `lib/` 纯函数 + 单测（base64、dockerconfig、kubeconfig、时间）。
4. secrets 页面全套 → typecheck → 本地 dev 冒烟。
5. serviceaccounts 页面全套 → typecheck → 本地 dev 冒烟。
6. 路由、侧栏、文案、manifest。
7. PRD（US/AC/FR/SC）与 Design（DEC/INV/GOT，含被否方案）。
8. 契约测试（ai-surface、无裸 `<button>`、无 AGPL 复制）+ 组件测试。
9. UI 用例 YAML + Playwright 测试 + 页面对象。
10. 门禁：`typecheck`、`vitest`、`check_docs --strict`、`generate_case_docs`。
11. **真实环境全链路验证**：逐页截图（1600×900），创建→查询→编辑→删除，失败自清理。
12. 清理测试数据并核对环境回到基线。

## 5. 验收（对照迁移指南第 9 节）

- [ ] 列表列、值格式、行操作顺序与旧版逐项对照
- [ ] 每个子页面单独截图核对
- [ ] 每处差异标注照搬/改进/不迁移并写进文档
- [ ] 推翻先前判断处补「被否方案」
- [ ] 端到端用例失败时自清理
- [ ] 全部门禁通过

---

## 6. 执行结果（2026-11-11）

### 6.1 交付

| 类别 | 内容 |
|---|---|
| 代码 | `pages/secrets`（8 文件）、`pages/serviceaccounts`（5 文件）、`lib/`（4 文件）、`components/resource/`（5 文件）、4 个路由文件、侧栏两个入口 |
| 共享层 | `api-client/src/resources.ts`（通用资源 API）、`secrets.ts`、`serviceaccounts.ts`；文案 zh/en 各补 120+ key |
| 文档 | `prd/`+`design/` 各 19 份（2×L2 + 17×L3），`tree.py` 新增两个子模块 |
| 用例 | 28 条规格（L2×2、L3×26）+ 28 个 Playwright 文件 + 2 个页面对象 + 5 个 fixture |
| 单元测试 | console-next 88、api-client 46、BFF 36、架构契约 166（全部通过）；`check_docs --strict` 0 错误 |

### 6.2 真实环境验证（A100，经本地 BFF → ks-apiserver）

- 三套 E2E 在稳定构建上全部通过：ConfigMaps 20 通过（4 条因数据条件 skip）、Secrets 15、ServiceAccounts 13。
- 过程中发现并修复的真实缺陷（均已补回归用例）：
  1. BFF 在响应头已发出后再次 `send` 会**进程崩溃**（`ERR_HTTP_HEADERS_SENT`）——已改为放弃该请求并加兜底 catch。
  2. 会话校验一次网络失败就**永久清除 token**，表现为页面突然回到登录页——已改为仅 401/403 清除，传输错误重试后保留会话。
  3. 「设为默认镜像仓库」在读取旧默认值完成前就能确认，导致两个默认——已改为确认前必须已知旧默认。
  4. kubeconfig 预览按「值替换」遮挡，token 被改写时**不遮挡**；且测试场景下会把 token 遮成空串——已改为按 `token:` 位置遮挡。
  5. 角色下拉把 `role-template-*` 聚合模板当成可选角色（27 个里只有 3 个可用）——已按 `annotation=kubesphere.io:creator` 过滤。
  6. 创建弹窗的项目在列表筛选晚到时不会被回填——三个创建弹窗均补「晚到回填」。
  7. Vite 开发代理只转发 `/api`，`/kapis` 落到 SPA 回退，资源页全部显示「资源不存在」——已补 `/kapis`、`/apis`。
  8. `dev-static-server.mjs` 无上游超时、无连接复用——已加 60s 超时与 keep-alive 池。

### 6.3 复核说明

- 验证期间另一位并行工作者在同一 checkout 修改 ConfigMaps 相关文件，导致开发服务器反复重启、构建产物被替换；最终验收改用固定构建 + 独立预览端口完成，期间未修改对方文件。
- 测试数据清理：`tc-e2e-*`、`tc-create-*`、`tc-dbg*` 在 `default`、`kube-frontend-demo` 两个命名空间下复核为 0 条。

### 6.4 验收清单

- [x] 列表列、值格式、行操作顺序与旧版逐项对照（见 design 的对照表）
- [x] 每个子页面单独截图核对（`tests/ui/artifacts/`）
- [x] 每处差异标注照搬/改进/不迁移并写进文档（DEC 系列）
- [x] 推翻先前判断处补「被否方案」（如遮挡方式的第二次决策）
- [x] 端到端用例失败时自清理（fixture `finally`）
- [x] 全部门禁通过
