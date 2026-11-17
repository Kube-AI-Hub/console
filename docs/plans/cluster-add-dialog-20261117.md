# 添加集群对话框：完整导入路径（2026-11-17）

> 单元：集群管理 · 添加集群（导入）。范围是 `/kube-frontend/clusters` 的主操作对话框及其直接依赖，不含 KubeKey 新建、移除集群、更新 kubeconfig（各自成点）。
> 方法见 [迁移指南](../legacy-ui-migration-guide.md)，规格见 [PRD](../../prd/kube-frontend/cluster-management/add-cluster.md) / [design](../../design/kube-frontend/cluster-management/add-cluster.md)。

## 1. 范围与基线

| 项 | 记录 |
| --- | --- |
| 用户任务、作用域 | 平台管理员在集群列表把一个已有集群接入平台；平台作用域，无 workspace/project 段 |
| 旧入口 | 老 console `/clusters` → `cluster.add`（[actions/cluster.js](../../src/actions/cluster.js)）→ `IMPORT_CLUSTER` 两步：基本信息（[BaseInfo](../../src/components/Forms/Cluster/BaseInfo/index.jsx)）+ 连接设置（[Configuration](../../src/components/Forms/Cluster/Configuration/index.jsx)） |
| 新入口 | `/kube-frontend/clusters` 主操作 → [AddClusterDialog.tsx](../../kube-frontend/apps/console-next/src/pages/cluster/AddClusterDialog.tsx) |
| 环境、角色 | 本地全栈（`localhost:5178` → BFF `8092` → B200），账号 `admin`（platform-admin） |
| 视口、主题、语言 | 1600×900 / 1280×900 / 1024×900；深色（默认）与浅色各截一轮；中文为主，英文另截首屏与预检提示 |
| 明确排除 | KubeKey 新建（本部署无 kubekey 控制器，`/kapis/kubekey...` 返回 403）；多步向导（DEC-07）；存量供应商拼写迁移 |
| 并行文件与安全边界 | 未改动并行批次文件；写入只在授权范围创建 `tc-e2e-*` 临时集群并在 finally 删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/具体断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-add-001 | `BaseInfo` `Form.Item CLUSTER_NAME` | 恒显示 | 集群名称；必填；`PATTERN_NAME`；失焦查重 | 保留 | AC-01/AC-04；`clusters:add-name`、`clusters:add-name-error` | 通过 |
| LEG-add-002 | `BaseInfo` 名称 `nameValidator` → `checkName`（`x-check-exist`） | 恒显示 | 名称已存在时提示「NAME_EXIST_DESC」 | 保留 | AC-04；`clusters:add-name-error` 含「已经有同名集群」 | 通过 |
| LEG-add-003 | `BaseInfo` `ALIAS` | 恒显示 | 别名，`PATTERN_ALIAS_NAME`，最长 63 | 保留 | AC-01/AC-02；`kubesphere.io/alias-name` | 通过 |
| LEG-add-004 | `BaseInfo` `TAG` + `CLUSTER_PRESET_GROUPS` | 恒显示 | 标签四选：production/development/testing/**demo** | 保留（补 demo） | AC-01；`clusters:add-group`，四个 option | 通过 |
| LEG-add-005 | `BaseInfo` `PROVIDER` + `CLUSTER_PROVIDERS` | 恒显示 | 供应商七项，可搜索；Azure 值原为 `Aure Kubernetes Service`（拼写错误） | 改进（修正拼写） | AC-01；`clusters:add-provider`，`Azure Kubernetes Service` | 通过 |
| LEG-add-006 | `BaseInfo` `DESCRIPTION` | 恒显示 | 描述，最长 256 | 保留 | AC-01/AC-02；`kubesphere.io/description` | 通过 |
| LEG-add-007 | `Configuration` `spec.connection.type` | 恒显示 | 直接 / 代理，默认直接 | 保留 | AC-01/AC-02；`clusters:add-mode:direct|proxy` | 通过 |
| LEG-add-008 | `Configuration` `EditMode mode="yaml"` | 仅直接连接 | kubeconfig YAML 编辑器（含上传/下载） | 改进（懒加载编辑器；上传/下载不做，见 §7） | AC-01；`.cm-content`，200px 高 | 通过 |
| LEG-add-009 | `Configuration` `HOW_TO_GET_KUBECONFIG` | 仅直接连接 | 文档链接 `getDocsUrl('kube_config')` | 保留 | AC-01；`clusters:add-doc` → `/kube-docs/docs/multicluster-management/enable-multicluster/retrieve-kubeconfig/` | 通过 |
| LEG-add-010 | `Configuration` `CLUSTER_AGENT_TITLE/DESC/IMPORT_TIP` | 仅代理连接 | 说明「提交后立即出现、部署代理前不就绪」 | 保留 | AC-02；`clusters:add-proxy-tip` | 通过 |
| LEG-add-011 | `handleImport` `safeBtoa` | 仅直接连接 | kubeconfig 以 base64 写入 `spec.connection.kubeconfig` | 保留 | AC-01；回读 base64 可解码为原文 | 通过 |
| LEG-add-012 | `handleImport` 代理分支 `unset(kubeconfig)` | 仅代理连接 | `spec.connection` 无 kubeconfig 键 | 保留 | AC-02；回读断言 `kubeconfig not in connection` | 通过 |
| LEG-add-013 | `handleImport` `joinFederation: true` | 恒 | 联邦加入 | 保留 | AC-01；回读 `joinFederation: true` | 通过 |
| LEG-add-014 | `validate()` 先校验再创建 | 仅直接连接 | 先 POST `/clusters/validation`，失败不创建 | 保留 | AC-03；拦截 400 时对象不存在 | 通过 |
| LEG-add-015 | `store.setValidationError` + Notify | 失败时 | 对话框内错误条 + 常驻通知 | 保留 | AC-03；`clusters:add-error` + toast | 通过 |
| LEG-add-016 | `Notify.success` + `success('/clusters/<name>')` | 成功时 | 成功提示并跳转集群页 | 改进（不跳转，只刷新列表 + 成功通知） | AC-01；`cluster.add.created` toast | 通过 |
| LEG-add-017 | `Clusters.renderSearch` `enabledActions.includes('create')` | 有 `clusters:create` | 显示「添加集群」 | 保留 | AC-05；SSAR 门控 + `clusters:add:disabled-hint` | 通过 |
| LEG-add-018 | `Providers` 新建/导入二选一 | — | KubeKey 新建路径 | 批准不做 | 「明确不做」第一条；`/kapis/kubekey...` 403 实测 | 批准不做 |
| LEG-add-019 | `BaseInfo` `NodeList`（新建时的节点清单） | 仅新建 | 主机清单 | 批准不做 | 同上（新建路径的一部分） | 批准不做 |
| LEG-add-020 | `EditMode` 上传/下载 YAML | 仅直接连接 | 从文件读 kubeconfig / 另存 | 批准不做 | §7；浏览器内粘贴等价，文件选择器与 jsdom/Playwright 交互成本不成比例 | 批准不做 |

统计：原子能力 20 项，通过 17，批准不做 3，未映射 0，未经证明承接 0。

## 3. 数据契约与全链路

| 能力 ID | 请求 | 字段 | 单位/精度 | 映射 | 缺值/异常 | 对账断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-add-001/003/004/005/006 | `POST /apis/cluster.kubesphere.io/v1alpha1/clusters` | `metadata.name`、`metadata.annotations{...}`、`metadata.labels{group}`、`spec.provider` | — | 表单 → `clusterImportBody` | 空别名/描述/标签时省略对应键 | 回读 labels=`{group: demo}`、annotations 两项、provider=`Kube AI Hub` |
| LEG-add-011/012 | 同上 | `spec.connection.{type,kubeconfig}` | base64 | `btoa(unescape(encodeURIComponent(...)))` | 代理无 kubeconfig 键 | 直接连接解码后等于原文；代理断言键不存在 |
| LEG-add-014 | `POST /kapis/cluster.kubesphere.io/v1alpha1/clusters/validation` | 同 body | — | 直接连接前置校验 | 404 视为端点缺失并继续；其他失败终止 | 拦截 400 时无创建请求 |
| LEG-add-002 | `GET /kapis/.../clusters/<name>` + `x-check-exist: true` | `{exist}` | — | `clusterImportApi.exists` | 200 `{exist:false}` 表示可用（不是 404） | 命中 host 时提示；自由名字提示消失 |

## 4. 交互、视觉与复用基线

| 项 | 约定 | 验证 |
| --- | --- | --- |
| 信息层次 | 「基本信息」「连接设置」两个 `h3` 段落，字段顺序沿用老 console | 截图 `add-1600-dark.png` |
| 字段栅格 | 所有控件同一 x 与宽度（630px @1600） | 实测 name/group/provider 均 `x=485 w=630`；编辑器 `x=511 w=603`（内边距差 26） |
| 主题 | ai-kit 语义 token，无字面色值 | 深/浅两套截图；错误条 `Alert tone="danger"` |
| 图标与图表 | 无图表；无图标装饰 | — |
| 通用控件 | `FormField`/`Input`/`Textarea`/`Select`/`RadioGroup`/`Alert`/`Notify`/`YamlEditor` | 无手写 `<input className=…>`、无自绘弹层 |
| 表单与弹窗 | 错误条在顶部、失败保留输入、成功后关闭并通知 | `add-1600-error.png`；E2E ADD_CLUSTER_03 |
| 窄屏 | 1024 下对话框 672px 宽居中，内容滚动（`max-h-[70vh]`），编辑器可滚到 | `add-1024-dark.png`；实测滚动区 `scrollHeight 953 / clientHeight 630` |

截图（`docs/plans/assets/cluster-add-dialog-20261117/`）：

| 文件 | 内容 |
| --- | --- |
| `add-1600-dark.png` / `add-1600-light.png` | 首屏两段结构，深/浅 |
| `add-1280-dark.png` / `add-1024-dark.png` | 两档断点 |
| `add-1600-editor.png` | 滚到底后的 kubeconfig 编辑器与文档链接 |
| `add-1600-proxy.png` | 代理连接：编辑器消失、说明出现 |
| `add-1600-en.png` / `add-1600-en-nametaken.png` | 英文首屏与预检命中提示 |
| `add-1600-error.png` | JSON 400 映射后的错误条（保留原文） |
| `add-created-list.png` | 创建后列表行：别名 + 对象名 + 「演示」徽标 + 未就绪 |

## 5. 编码与回归

- [x] AC 覆盖功能、数据语义、状态、权限、交互与视觉；design 写完整决策（DEC-07..10）与被否方案。
- [x] YAML 与 Python 一一镜像：`TC-…-ADD_CLUSTER-01/03/04/05`。
- [x] 旧能力表独立比对（§2），20 项全部有归宿。
- [x] 单测、类型检查、构建、严格规格门禁分别记录（§6）。
- [x] 相关 E2E 串行 `-n 0`；写入用例 `finally` 清理。
- [x] 同次响应核对（§3 最后一行）。
- [x] 三档 + 深浅 + 中英文截图人工复核。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未通过或未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过（17/20，3 项批准不做） | §2 表 | 无未映射项 |
| 数据语义 | 通过 | §3 表 + 真实回读（见下） | — |
| 交互与权限 | 通过 | E2E ADD_CLUSTER-01/03/04/05 全过 | 真实非 admin 账号的 403 分支未跑（用 SSAR 拦截模拟） |
| 视觉与主题 | 通过 | 10 张截图，三档两主题两语言 | 深色 + green 色调未单独截图 |
| 静态/类型/构建/测试 | 通过（含基线失败说明） | 见下 | 两条既有失败：`configmaps-page.test.tsx`、`gpu-parity.test.tsx`；两条既有 typecheck 失败：`network-create.test.ts`、`workspace-groups.test.ts`（stash 后仍失败，非本批引入） |
| 本地全栈读取 | 通过 | `localhost:5178` → BFF `8092` → B200，admin | — |
| 新版部署/member/全站 | 未验收 | — | 未部署到 mlu370/B200 前端；member 集群未验；全站串行 E2E 未跑 |

命令与结果：

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @kube-ai-hub/api-client test` | 392 passed |
| `pnpm --filter @kube-ai-hub/api-client typecheck` | 仅两条既有失败（见上） |
| `pnpm --filter @kube-ai-hub/console-next typecheck` | 通过 |
| `pnpm --filter @kube-ai-hub/console-next test` | 195 passed，2 failed（`configmaps-page`、`gpu-parity`，既有）；另有 2 个既有 `.test.ts` 因 `src/styles.css` 路径缺失加载失败 |
| `pnpm --filter @kube-ai-hub/console-next build` | 通过 |
| `pytest tests/kube-frontend/cluster-management -k ADD_CLUSTER -n 0` | **4 passed / 15.1s** |
| `pytest tests/kube-frontend/cluster-management -k "ADD_CLUSTER or CLUSTER_EDIT_INFO" -n 0` | **5 passed / 23.05s**（含编辑信息） |
| `pytest tests/kube-frontend/cluster-management -k "ADD_CLUSTER or CLUSTER_EDIT_INFO or CLUSTER_MEMBERS" -n 0` | **7 passed / 41.82s** |
| `pytest tests/kube-frontend/cluster-management -n 0`（全模块） | 108 passed / 4 failed / 2 skipped；失败项为 `CLUSTER_EVENTS_02`、`CLUSTER_LIST_01`、`DEVOPS_CREDENTIALS_01`、`MONITOR_06`，均为既有（`CLUSTER_LIST_01` 已 stash 复现） |
| `python3 prd/tools/check_docs.py` | `errors=0 warnings=0` |
| ai-kit `tsc --noEmit` / `vite build` / `storybook build` | 通过 |
| ai-kit `test/form-focus-invalid.test.tsx` | 5 passed |
| ai-kit `test/select-scroll-shield.test.ts` | 3 passed |
| ai-kit `test/modal-error-reveal.test.tsx` | 6 passed |
| ai-kit 全量 vitest | 9 failed（`Invalid hook call`，双 React 的既有基线；stash 后同样失败） |

真实接入回读（`admin`，临时集群，已删除）：

```
labels:      {"cluster.kubesphere.io/group": "demo"}
annotations: {"kubesphere.io/alias-name": "视觉验收集群", "kubesphere.io/description": "..."}
provider:    Kube AI Hub
connection:  {"type": "proxy", ...}   （无 kubeconfig 键）
joinFederation: true
列表行:       视觉验收集群 / tc-e2e-visual-e0a022 / 演示 / 未就绪 / 成员集群
DELETE → 200；再 GET → 404
```

## 7. 本批修掉的两个真实缺陷

1. **`dev-static-server.mjs` 只转发 `content-type`/`authorization`**，把 `x-check-exist` 丢了。表现是名称预检拿到完整对象而非 `{exist}`，于是「已被占用」永远显示为可用。改为转发除 hop-by-hop 头之外的全部请求头，并在 5178 上复验 `{"exist":true}`。
2. **Radix `Select` 拒绝 `value: ''` 的选项**。标签下拉的「无」原用空串，渲染时直接抛错、对话框白屏。改用哨兵 `__none__` 再映射回 `''`（与 `ResourceList` 的 `ALL_OPTION` 同一做法）。

## 7b. 后续两轮：下拉滚动、跨下拉关闭、校验错误定位

### 下拉框无法滚动（`Select` 在弹窗内）

Radix Dialog 用 `react-remove-scroll` 锁页面滚动，其 `wheel`/`touchmove` 监听挂在 `document` 的**捕获阶段**，把弹窗外的滚动一律 `preventDefault`。Select/Popover 的 portal 渲染到 `document.body`——正是「弹窗之外」，于是列表有 `overflow:auto`、有 `scrollHeight > clientHeight`，却滚不动：实测 `scrollTop` 恒为 0（`max` 为 24），每个 wheel 事件的 `defaultPrevented` 都是 `true`。

修复：`packages/ai-kit/src/primitives/Select.tsx` 的 `useScrollLockShield` 在弹层自身上加捕获阶段监听，`stopPropagation()` 让事件到不了 document 的锁；只在 `body[data-scroll-locked]` 存在时生效，非弹窗场景保持原样。同时把高度从固定 `max-h-64` 改成 `min(16rem, var(--radix-*-content-available-height))`：360px 高视口下 256px 会超出窗口底边，最后一项根本到不了。

验证（四个视口 900/700/480/360，两个下拉）：`scrollTop` 从 0 变为 24/30，最后一项可见且不越出视口。

### 供应商下拉打开时点标签，供应商不收起

Radix `Select` 的触发器在自己的 `pointerdown` 上调用 `preventDefault()`（Select 源码 `index.mjs:197`），这会抑制浏览器随后合成的 `mousedown`。搜索式下拉的「点外部关闭」原挂在 `mousedown` 上，因此永远收不到。

修复：`Select.tsx` 与 `AutoComplete.tsx` 的 outside-dismiss 改挂 `pointerdown`（捕获阶段）。同时把搜索式下拉的触发器从 `onClick` 改为 `onPointerDown` 打开——反向（标签打开时点供应商）的第一次点击会被 Radix Select 的 dismiss 层消费掉 `click`，与 Radix 自己的触发器一致才能一次点击即切换。

验证：供应商→标签，`aria-expanded` 变 `false` 且只剩标签列表；标签→供应商，第一次点击收起标签、第二次打开供应商（Radix 的标准 dismiss 行为）。

### 校验失败时错误信息被滚动区挡住

只填集群名称就点确认时，kubeconfig 的错误渲染在可视区之下（实测 443px），按钮看起来没反应。

修复分两层：

1. **提交路径**（知道哪个字段失败）：ai-kit 的 `focusFirstInvalidField(container, fieldKeyOrId)` —— 滚字段容器（`data-field-key`）而非错误段落、`block: 'center'`、聚焦真正的控件（CodeMirror 聚焦 `.cm-content`）、`requestAnimationFrame` 等一帧。`ResourceForm` 与手写对话框共用。
2. **渲染路径**（不知道谁失败）：`Modal` 的滚动体上挂 `observeHiddenErrors`（`packages/ai-kit/src/utils/observeHiddenErrors.ts`），用 `MutationObserver` 观察 `[role="alert"]` 与 `[data-invalid="true"]`，把第一个**不在可视区**的错误滚入视野。这条覆盖全部 73 个对话框，包括手写校验的（成员邀请、YAML 编辑器、网策略等），无需逐个改。

两条规则避免打扰：错误已经在屏上时不滚动；一次提交里多个错误只滚第一个（否则会停在最后一个）。空 `role="alert"` 占位不滚。

`FormField` 新增 `fieldKey` → `data-field-key`，让没有 id 的控件（CodeMirror）也能被定位。

验证（1600×760）：空 kubeconfig → `scrollTop` 0→443、错误可见、焦点在 `.cm-content`；非法名称 → 滚回 0、错误可见、焦点在输入框。

验证（mlu370，1400×620）：添加集群 → `scrollTop` 485、错误可见；项目成员邀请（手写校验）→ 错误「请输入用户名。」可见。

### 编辑信息复用添加集群的字段组件

两个对话框收集同样四个字段，此前各写一份并已漂移（编辑信息缺 `demo` 标签、供应商是自由文本 + `<datalist>`）。抽出 `ClusterIdentityFields`（`apps/console-next/src/pages/cluster/ClusterIdentityFields.tsx`），两个对话框共用；编辑信息同时补上顶部错误条与「已保存」通知。

验证：编辑信息的标签下拉为 5 项（含演示）、供应商为 8 项可搜索下拉，与添加集群一致；`CLUSTER_EDIT_INFO_01` E2E 通过。

## 8. 后续

- 移除集群 / 更新 kubeconfig（另立功能点，已在集群列表有行操作）。
- 接入进度提示（等待 Ready 的轮询）——当前只有列表状态列的控制器原因。
- 上传/下载 kubeconfig 文件（LEG-add-020）如确有必要再评估。
- 全站串行 E2E 与部署环境验收。

## 9. 测试环境（2026-11-17 起改用 mlu370）

本批的浏览器验证从 B200 切到 **mlu370**，本地起一套独立的前端栈（不占用已有的 5174/5178/5179）：

| 组件 | 地址 | 上游 |
| --- | --- | --- |
| 静态站 | `http://localhost:5180/kube-frontend/` | BFF `8094` |
| BFF | `http://127.0.0.1:8094` | 隧道 `18093` → `ks-apiserver`（mlu370） |
| 隧道 | `127.0.0.1:18093` | `ssh -L 18093:10.233.60.28:80 cam` |

登录用 mlu370 的 `admin` / `Kah@2025`（见 [`环境/mlu370环境.md`](../../../环境/mlu370环境.md)）。

两点与 B200 不同，记录以免误判：

- **mlu370 的 `ks-apiserver` 不实现 `x-check-exist`**：那是 console 服务端（`server/middlewares/checkIfExist.js`）的中间件。走 apiserver 时该端点返回完整对象而非 `{exist}`，名称预检因此静默跳过（设计内的 fail-open），不会误报「已占用」。
- **mlu370 的 `/oauth/token` 在 ks-console 路径上要求 `mix()` 密码**：BFF 发明文，只有直连 apiserver 才通过。所以隧道指向 apiserver，不指向 `30880`。

