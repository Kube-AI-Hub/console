# kube-frontend 集成与 mlu370 发布（2026-11-17）

新前端（kube-frontend）以**独立 Deployment** 挂在老控制台同一地址的 `/kube-frontend` 前缀下，老控制台顶部导航新增入口，两边共用 `kah_token`。

## 改动清单

### 新前端适配子路径

| 文件 | 改动 |
|---|---|
| `kube-frontend/apps/console-next/vite.config.ts` | `base: '/kube-frontend/'`，产物引用带前缀 |
| `kube-frontend/apps/console-next/src/api.ts` | `APP_BASE = '/kube-frontend'`；`createClient({ baseUrl: APP_BASE })`；`TOKEN_KEY = 'kah_token'` |
| `kube-frontend/packages/api-client/src/{exec,node-terminal}.ts` | 新增 `basePath`，WebSocket URL 带前缀 |
| `kube-frontend/apps/console-next/src/components/resource/ExecConsoleDialog.tsx` | 传入 `basePath: APP_BASE` |
| `kube-frontend/apps/console-next/src/routes/login.tsx` | 删除，改为 `kube-frontend.login.tsx`（`/kube-frontend/login`） |
| `kube-frontend/apps/console-next/src/routes/index.tsx` | 删除（`/` 不再属于新前端） |
| `kube-frontend/apps/console-next/src/routes/__root.tsx` | 未登录跳 `/kube-frontend/login`；`isPublicRoute` 加前缀 |
| `kube-frontend/apps/console-next/src/shell/AppShell.tsx` | 退出跳 `/kube-frontend/login`；`compute.matches` 去掉裸 `/` |
| `kube-frontend/apps/console-next/src/pages/login/LoginPage.tsx` | 默认落点 `/kube-frontend/` |
| `kube-frontend/apps/console-next/src/shell/AuthProvider.tsx` | 旧键 `kubesphere-token` 迁移到 `kah_token`；同步写 `kah_token` cookie |

### BFF 兼做静态服务

| 文件 | 改动 |
|---|---|
| `kube-frontend/server/src/static.ts` | 新增：剥前缀、路径穿越防护、按扩展名分流、缓存头 |
| `kube-frontend/server/src/index.ts` | `staticDir` 依赖；所有路径先 `stripAppPrefix` |
| `kube-frontend/server/src/proxy.ts`、`upgrade.ts` | 转发前剥前缀 |
| `kube-frontend/server/src/dev.ts` | 读 `STATIC_DIR` |
| `kube-frontend/server/src/auth/session.ts` | `encodePassword` 改为**明文**（见下） |
| `kube-frontend/server/scripts/build.mjs` + `server/package.json` | esbuild 打包成单文件，镜像里不带 `node_modules` |
| `kube-frontend/scripts/dev-static-server.mjs` | 同样按前缀剥离 |

### 老控制台接入

| 文件 | 改动 |
|---|---|
| `console/server/config.yaml` | 新增 `server.newConsole.{enabled,target}` |
| `console/server/libs/portalMounts.js` | `NEW_CONSOLE_PREFIX`、`isNewConsolePath`、`stripNewConsolePrefix` |
| `console/server/proxy.js` | `createPortalProxy` 支持 `stripPrefix`；导出 `kubeFrontendProxy` |
| `console/server/routes.js` | catch-all 之前 `mountPortal('/kube-frontend', kubeFrontendProxy)` |
| `console/server/components/wsProxy.js` | 新前端前缀的 upgrade 转发并剥前缀 |
| `console/server/controllers/view.js` | 下发 `client.portal.newConsole` |
| `console/src/utils/returnPath.js` | `visibleProductEntries` 插入 `newConsole` |
| `console/src/components/Layout/Header/index.jsx` | 新增入口（`computing` 图标，整页跳转） |
| `console/src/core/containers/Login/index.jsx` | `/kube-frontend` 加进整页跳转白名单 |
| `console/locales/*/l10n-appStore-list.js` | 13 个语言新增 `NEW_CONSOLE` |

### 构建与部署

| 文件 | 用途 |
|---|---|
| `console/kube-frontend/Dockerfile` | 单容器：静态产物 + 打包后的 BFF |
| `console/hack/build_kube_frontend.sh` | 串行构建 + 推送 + 打印 digest |
| `console/deploy/kube-frontend.yaml` | Deployment + Service（`kubesphere-system`） |
| `console/deploy/ks-console-local_config.yaml` | 开启 `newConsole` 的配置样本 |
| `console/hack/docker_build_multiarch*.sh` | `PLATFORMS` 改为可覆盖 |

## 一个被实测推翻的旧结论

BFF 此前用老控制台的 `mix(salt, base64(pw))` 提交密码，注释声称「本集群接受密文、拒绝明文」。mlu370 实测（2026-11-17）：

| 提交 | 结果 |
|---|---|
| 明文 | **200 + token** |
| `mix()` 密文 | 400 `invalid_grant` |

老控制台发密文是因为它自己的服务端（`injectOAuthCredentials`）会解回来再转发；BFF 直连 ks-apiserver，没有这一跳。已改为明文，与 `DEC-L2-KUBE-FRONTEND-LOGIN-02` 一致，并更新了 `server/test/auth.test.ts`。

## 镜像

| 镜像 | tag | digest（amd64 manifest） |
|---|---|---|
| `ks-console` | `develop-20261117` | `sha256:d86f57e5a92c4d0c4e62ddb3da6f7b14e9ffb39cb1e91d9f12fb35bfd890ffe2` |
| `kube-frontend` | `develop-20261117c` | `sha256:79464c8c3c7bbdccab6f81f8d25ab59f7e2d14d43c8b0a55a7dfac806727287b` |

`kube-frontend` 有两个被替换的中间 tag（`…17`、`…17b`），分别修掉了「相对 `STATIC_DIR` 导致全部资源 404」与「`curl` 默认 `*/*` 被当 404」。ACR 的 tag 不可覆盖，所以每次重打都用新 tag。

## mlu370 上的变更

1. `kubectl apply -f console/deploy/kube-frontend.yaml` → Pod `1/1 Running`，`/api/ai/manifest` 探针通过。
2. `kubectl -n kubesphere-system set image deploy/ks-console ks-console=…ks-console:develop-20261117@sha256:d86f57e5…`。
3. 移除两个历史挂载：hostPath `/srv/code/console/dist`（`console-dist`）与 ConfigMap `ks-console-cluster-code`。旧补丁（集群接入引导文字配色）已在新产物里。
4. `ks-console-config` 的 `local_config.yaml` 增加：
   ```yaml
   server:
     newConsole:
       enabled: true
       target: http://kube-frontend.kubesphere-system.svc:8080
   ```
5. `ks-console` 滚动时旧 Pod 卡在 `ContainerCreating`，`--grace-period=0 --force` 删掉后新 Pod 起来（单节点集群 + `maxUnavailable: 25%` 导致 anti-affinity 暂时无解）。

## 验证证据

### 路径矩阵（`http://10.1.37.18:30880`）

| 路径 | 状态 | Content-Type |
|---|---|---|
| `/` | 200 | text/html（老控制台） |
| `/login` | 200 | text/html（老控制台） |
| `/kube-frontend` | 200 | text/html（新前端外壳） |
| `/kube-frontend/` | 200 | text/html |
| `/kube-frontend/login` | 200 | text/html |
| `/kube-frontend/clusters/host` | 200 | text/html |
| `/kube-frontend/assets/<hash>.js` | 200 | text/javascript，`immutable` |
| `/kube-frontend/assets/<missing>.js` | 404 | application/json |
| `/kube-frontend/api/session/login`（admin） | 200 | token + user |
| `/platform-model/` | 200 | text/html |

### 顶部入口对齐（`getBoundingClientRect()`）

| 按钮 | x | width | height | y |
|---|---|---|---|---|
| 工作台 | 249 | 74 | 32 | 18 |
| 新版控制台 | 335 | 98 | 32 | 18 |
| 智能体工坊 | 445 | 98 | 32 | 18 |
| 模型与数据 | 555 | 98 | 32 | 18 |
| 生态广场 | 665 | 86 | 32 | 18 |

高度与 y 完全一致，相邻间距恒为 12px。

截图：

- 老控制台顶部导航（入口已出现）：`console/tests/ui/artifacts/test_TC_L3_KUBE_FRONTEND_INTEGRATION_ENTRY_01[chromium]/integration-entry.png`
- 点击后落到新 UI 工作台（无登录表单）：同目录 `integration-entry-landing.png`
- 共用登录态：`console/tests/ui/artifacts/test_TC_L3_KUBE_FRONTEND_INTEGRATION_SESSION_01[chromium]/integration-session-shared.png`

### 测试

| 套件 | 结果 |
|---|---|
| `pnpm --filter @kube-ai-hub/bff test` | 71 passed（含新增 `static.test.ts` 18 个） |
| `node --test server/components/wsProxy.node-test.cjs` | 4 passed |
| `pnpm --filter @kube-ai-hub/console-next typecheck` | 通过 |
| `pytest tests/kube-frontend/login` | 3 passed |
| `pytest tests/kube-frontend/workbench tests/kube-frontend/configmaps` | 69 passed, 2 skipped（列表不足两页 / 无长键名对象） |
| `pytest tests/kube-frontend/integration` | 4 passed |
| `python3 prd/tools/check_docs.py` | `errors=0 warnings=0` |

### 顺带修掉的测试问题

- `tests/ui/pages/login.py` 的 `sign_in` 现在先等 `data-ai-state=ready`：React 水合前填表会被丢弃，表现为「密码为空」。
- 三条用例用「URL 里不含 `kube-frontend`」筛真实 API 请求；前缀化后该条件失效，改成筛 `/kapis/`。
- `tests/ui/conftest.py`、`pages/*.py`、`tests/kube-frontend/**`、`cases`/`specs` 的 token 断言统一为 `kah_token`。

## 回滚

1. `ks-console-config` 的 `local_config.yaml` 置 `newConsole.enabled: false`，`kubectl -n kubesphere-system rollout restart deploy/ks-console`。入口与 `/kube-frontend/*` 同时消失，老控制台不受影响。
2. 需要回退老控制台产物时：`set image deploy/ks-console` 到 `ks-console:develop`，并恢复 `console-dist` hostPath 与 `ks-console-cluster-code` 两个挂载（本次已从 Deployment 移除）。
3. `kube-frontend` Deployment 可以独立删除，不影响老控制台。

## 已知遗留

- `ka.watering.ai` 的 `/` 由 csghub-portal 接管，console 不在它后面；本次只保证 NodePort `30880`。要在该域名下暴露新前端，需要在 csghub-charts 的 ingress 上加 `/kube-frontend` → `ks-console` 的路径（未做）。
- 新前端的集成测试要求 `KA_LOGIN_USERNAME` 在该环境存在；mlu370 上只有 `admin`，所以本地跑用例时显式覆盖了它。
- `console/src/utils/returnPath.test.js` 的 Jest 环境本身起不来（`enzyme` → `cheerio` 解析失败），与本次改动无关；该文件的新增断言未能在本机执行。
