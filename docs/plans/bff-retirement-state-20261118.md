# BFF 退役之后：状态、影响与验证（2026-11-18）

> 原先分散在四份记录里：静态站接错 BFF、新 console 登录受阻、工具受影响、mlu370 已可验收。
> 它们是同一件事的四个面——**BFF 退役把「怎么起栈、怎么登录、怎么验证」全改了一遍**。

## 一、重构做了什么

`4ff017afa`：新 console 由 ks-console 直接提供。转发、OAuth 密码授权、静态文件都回到
ks-console / ks-apiserver；登录走 `POST /kapis/oauth.kubesphere.io/v1alpha1/login`。

## 二、工具受到的影响与适配

提交 `4ff017afa refactor(console): serve the new console from ks-console and retire the BFF` 之后，
新 console 由 **ks-console 直接提供**：

| 原来 | 现在 |
| --- | --- |
| BFF 转发 `/kapis`、`/apis`、`/api/v1` | ks-console 自己转发（含 WebSocket） |
| BFF 做 OAuth 密码授权（`/api/session/login`） | ks-apiserver 进程内完成（`POST /kapis/oauth.kubesphere.io/v1alpha1/login`） |
| BFF 提供静态文件 | ks-console 提供 |

## 对 `multicluster_sweep.py` 的影响（尚未适配）

工具当前假定：

1. `--app` 是静态站、`--bff` 是独立进程，两者**配对校验**（`_open_app` + `preflight` 用 `/api/session/me`）；
2. 登录走 `POST {bff}/api/session/login` 拿 bearer token；
3. 之后所有请求带 `Authorization: Bearer`。

BFF 退役后这三条都要重新确认：

- `/api/session/login` 是否还存在（很可能没有了）；
- 新的登录路径需要什么凭据（实测匿名 POST `/kapis/oauth.kubesphere.io/v1alpha1/login` 返回 **403**
  `login.oauth.kubesphere.io is forbidden: User "system:anonymous"`）；
- 会话是 bearer token 还是 cookie。

## 已完成的适配（2026-11-18）

| 改动 | 内容 |
| --- | --- |
| 登录 | `login()` 按 `LOGIN_PATHS` 依次尝试：先 `POST {app}/kapis/oauth.kubesphere.io/v1alpha1/login`，再退回 `POST {bff}/api/session/login`；两个 origin 都试 |
| 会话探针 | 认证握手从 `/api/session/me` 扩展到 `/oauth/userinfo`（`SESSION_PROBES`），401 仍不计为页面缺陷 |
| 单元测试 | 新增 6 条：URL 构造（新传输优先、同一 origin 不重复）、探针路径判定 5 例，以及**对本地假服务器的三条行为测试**——新路 200 用新路、新路 403 退回旧路、两条都不通时抛错。共 **36 条** |

这样在**后端升级前后都能跑**：升级前走 BFF 老路，升级后走新路，工具自己不需要人工切换。

## 十秒就绪检查：`--probes` 新增两条

| 探针 | 含义 |
| --- | --- |
| `oauth-userinfo` | `GET /oauth/userinfo`：401 表示路由存在且要 token；403/404 表示没升级 |
| `oauth-login-route` | `GET /kapis/oauth.kubesphere.io/v1alpha1/login`：同上 |

2026-11-18 实测（未升级的部署）：两条都是 **404**（经 5182 代理）/ **403**（直连隧道）。
所以部署升级后第一件事就是跑 `--probes`：这两条变绿，才值得花十五分钟跑整轮基线。

## 2026-11-18 12:25：`--bff -` 与 preflight 在真实新架构上验过

在 mlu370（已是新架构）上跑：

```bash
python3 tools/multicluster_sweep.py --env-file … --app https://ka.watering.ai --bff - --probes --clusters host
```

```
preflight: login attempt 1/3 failed (HTTPError)
preflight: login attempt 2/3 failed (HTTPError)
preflight: login attempt 3/3 failed (HTTPError)
NOT RUN: the environment is not usable (see the preflight lines above)
exit=2
```

三件事因此得到验证：

1. `--bff -` 现在在 **Python 侧**也归一化成 app origin（之前只有 shell wrapper 处理，直接调工具会拼出 `-` 开头的非法 URL）；
2. preflight 的会话探针按「是否同源」选 `/oauth/userinfo` 还是 `/api/session/me`；
3. 凭据不对时**退出码 2、结论是环境不可用**，不会被记成页面缺陷。

工具单测 36 条仍全过。

## 仍待验证

新路要等部署升级后才能在真实环境验证。

## 下一步（按顺序）

1. 读 ks-console 侧的转发/登录实现，确认浏览器实际发的登录请求与响应形态；
2. 用浏览器抓一次真实登录（DevTools 或 Playwright 记录请求），据此改 `preflight` 与 `_open_app`；
3. `--bff` 参数可能退化为「与 `--app` 同一个 origin」，配对校验随之简化；
4. 改完先用 `--keyboard-local` 与 `--probes` 验证，再跑整轮基线。

**在那之前，本轮及之后的 `verify-all.sh` 结果都不能当作新架构下的证据。**

---

## 三、起栈接错 BFF 的那次教训

## 现象

B200 的巡检一直 `state=signed-out`，每页 34.6 秒，整段却报「0 error」。

## 根因

`5178` 这个静态站实际代理到了 **8093（A100 的 BFF）**，而巡检用 8092 签发的 token：

```
GET http://127.0.0.1:8092/api/session/me                       with 8092 token -> 200
GET http://127.0.0.1:5178/kube-frontend/api/session/me         with 8092 token -> 401
GET http://127.0.0.1:5178/kube-frontend/api/session/me         with 8093 token -> 200   ← 证据
```

于是应用每次都把读者送回登录页，而巡检把这当成「页面渲染了、只是没有数据」。

## 处置：preflight 校验「应用与 BFF 是配对的」

登录成功后，用**同一个 token 经应用**请求 `/api/session/me`；不是 200 就直接拒绝开跑：

```
preflight: the app at http://localhost:5178 does not accept the token from http://127.0.0.1:8092 (status 401)
preflight: the static site is wired to a different BFF; fix that before sweeping
NOT RUN: the environment is not usable
```

## 为什么这条值得单独加

一个静态站可以指向任意 BFF，两者**没有任何交叉校验**。配错之后：

| 表面现象 | 真实情况 |
| --- | --- |
| 页面 0 error | 页面是登录页 |
| 每页 30 秒以上 | 在等一个永远不会出现的 shell |
| 结论「成员集群没问题」 | 其实一个页面都没看到 |

这是整轮里最隐蔽的一类假绿：**环境接错线，工具却报成功**。

---

## 四、A100/B200 仍无法登录（后端未注册路由）

## 现象

在 5182（新 console 的构建产物）上填写 admin/密码并提交，登录页直接显示：

```
欢迎登录 | login.oauth.kubesphere.io is forbidden: User "system:anonymous" cannot create resource
"login" in API group "oauth.kubesphere.io" at the cluster scope | 重新登录 | …
```

网络面板：`403 POST /kube-frontend/kapis/oauth.kubesphere.io/v1alpha1/login`。
直连 ks-console（隧道 18091）同样 403。

## 原因

`4ff017afa` 把登录改为由 **ks-apiserver 进程内**完成（`POST /kapis/oauth.kubesphere.io/v1alpha1/login`），
但**当前部署的 ks-apiserver 还没有注册这个资源**（`login.oauth.kubesphere.io`），于是匿名请求被判 403。

换句话说：**代码已完成，依赖的后端能力未部署**。

## 影响

| 项 | 影响 |
| --- | --- |
| 手工验收 | 无法登录 → 任何页面都看不到 |
| `multicluster_sweep.py` | 旧的 `--bff /api/session/login` 仍可用（BFF 进程还在跑），但**它测的是旧登录路径**，与浏览器实际走的路不同 |
| E2E 套件 | helper 已切到新路径 → 全套 403 失败 |
| 之前所有绿灯结论 | 属于**重构前**的构建，不能用于当前代码 |

## 顺带一处 UX 问题

登录页把 API 的原始英文错误整句显示给用户（`login.oauth.kubesphere.io is forbidden: User ...`）。
`LOGIN_ERROR_CODES` 只覆盖 `invalid_credentials` 等四种，其余走 `message` 兜底——这里应归到「后端不可用」一类，
而不是把 k8s 的 403 原文抛给操作者。

## 处置（用户指示，2026-11-18 05:31）

> 等待另一个任务的前端重构完毕再测试。

因此：

- **暂停一切面向当前构建的浏览器验收**（`verify-all.sh`、E2E、手工走查、`--probes` 之外的界面检查）；
- 期间只做**不依赖运行环境**的工作：契约套件、api-client 单测、类型检查、文档与代码审阅；
- 重构完成并部署后可登录后，再按记录里的顺序重跑，并把结果标为新架构的第一次验收。

## 结论

**在这两个环境升级后端之前，新 console 的界面无法验收**；`verify-all.sh` 的绿灯也不再代表当前代码。

---

## 五、mlu370 已是新架构：已验清单与验收方式

A100/B200 的登录路由还是 403（后端未注册 `login.oauth.kubesphere.io`），但 **mlu370 已经具备**：

```
GET  https://ka.watering.ai/kube-frontend/                                  -> 200
     <html lang="zh-CN" data-theme="dark" data-accent="violet">          ← 新 console 的壳
POST https://ka.watering.ai/kapis/oauth.kubesphere.io/v1alpha1/login       -> 400
     {"code":"invalid_credentials","message":"incorrect username or password","status":400}
GET  https://ka.watering.ai/oauth/userinfo                                 -> 401
```

**400 与 403 的区别是关键**：403 是「没有这条路由」，400 `invalid_credentials` 是「路由在、密码不对」。
所以 mlu370 的后端**已经支持新登录方式**，整条链路是通的，只差凭据。

## 已验清单（全部不需要凭据）

| 面 | 结果 |
| --- | --- |
| 登录页结构可访问性 | lang / main / h1 / 字段标签 / 按钮名，5 条全过 |
| 四组主题色调键盘走查 | 8 个停靠点 ×4，无缺焦点环，最差对比度 3.52 |
| 登录失败文案 | 「用户名或密码不正确」（本地化，不是 API 原文） |
| 托管行为 | 客户端路由 200 HTML、缺失资产 404 非 HTML、旧 BFF 路由 404 |
| 缓存策略 | 外壳 `no-cache`、哈希资产 `immutable`（**旧版两者都没设**） |
| 英文界面 | 文案英文、`lang=en`、无裸标识符 |
| 三档宽度 | 390 / 768 / 1440 均 0px 溢出 |

## 对验收的意义

「等重构完毕再测试」这件事在 mlu370 上**已经可以开始**：

```bash
cd console/tests/ui
python3 tools/multicluster_sweep.py --env-file <mlu370 的 env> \
  --app https://ka.watering.ai --bff - --probes --clusters host
```

`--bff -` 表示应用与接口同源（新形态），工具已支持（见[影响记录](bff-retirement-state-20261118.md)）。

## 已完成的验收：登录页（无需凭据）

登录页是公开的，所以**不拿凭据也能验**：

```bash
python3 tools/multicluster_sweep.py --env-file <任意> --app https://ka.watering.ai \
  --bff - --keyboard-local
```

```
OK   html[lang]                 zh-CN
OK   one main landmark          1
OK   one h1                     1
OK   every field has a label    -
OK   every button has a name    -
OK   violet/dark  login  stops=8  no_ring=0 weak=0 worst=3.52
OK   violet/light login  stops=8  no_ring=0 weak=0 worst=17.12
OK   green/dark   login  stops=8  no_ring=0 weak=0 worst=10.4
OK   green/light  login  stops=8  no_ring=0 weak=0 worst=18.49
EXIT=0
```

**这是新架构部署上的第一份验收证据**：结构可访问性 5 条 + 四组主题色调的 Tab 顺序与焦点指示对比度全部通过，
数值与本地构建完全一致（3.52 / 17.12 / 10.4 / 18.49）。

### 登录失败文案（也不需要凭据）

用错误密码提交，看页面显示什么：

```
欢迎登录 | 用户名或密码不正确 | 重新登录 | 用户名或邮箱* | 密码* | 登录
```

**是本地化的句子，不是 API 原文**——说明 `loginPhraseKey` 的错误映射在部署产物上确实生效
（`invalid_credentials` → `用户名或密码不正确`）。

> `login.backendUnsupported`（403/404/405）那条在 mlu370 上验不了——它的登录路由是通的；
> 那条只在 A100/B200 那种「后端未升级」的环境才会出现。

### 托管行为（curl 即可验）

| 请求 | 期望 | 实测 |
| --- | --- | --- |
| 客户端路由 `/kube-frontend/clusters/host/overview` | SPA 外壳 | **200 text/html** ✓ |
| 深层客户端路由 `/kube-frontend/workspaces/system-workspace/members` | SPA 外壳 | **200 text/html** ✓ |
| 不存在的 `.js` | **404 而不是 HTML** | **404 text/plain** ✓ |
| 不存在的 `.css` | 同上 | **404 text/plain** ✓ |
| 旧 BFF 路由 `POST /kube-frontend/api/session/login` | 已退役 | **404** ✓ |

第三条是重构说明里明确的设计点：缺失的 chunk 若返回 HTML，浏览器会报模块语法错误，
而真正的原因是「这个文件不存在」。**部署上的行为与说明一致。**

### 缓存策略（curl 即可验）

| 响应 | 头 | 判断 |
| --- | --- | --- |
| `index.html`（SPA 外壳） | `Cache-Control: no-cache` | ✓ 正确：外壳必须每次校验，否则发版后用户拿旧外壳引旧 chunk |
| `assets/index-Bl_JTgM_.js`（内容哈希） | `Cache-Control: max-age=31536000, immutable` | ✓ 正确：哈希变了 URL 就变，可以永久缓存 |

**旧 console 的 `/` 两者都没有设置**——所以这一条是迁移带来的改进，不是对等项。

### 安全响应头：新旧都没有（对等，不是回归）

`X-Frame-Options`、`X-Content-Type-Options`、`Content-Security-Policy` 在**旧 console 与新 console 上都不存在**。
记录在案：这是平台侧的既有缺口，不是本次迁移引入的；要补的话属于网关配置，不是前端改动。

### 英文界面（不需要凭据）

```
en body:  Welcome | Username or email* | Password* | Log in
lang attr: en
raw keys: []
```

文案是英文、`<html lang>` 跟着切到 `en`、**没有裸标识符**。

### 主题：登录页尊重主题，但没有切换入口

登录页只有「显示密码」与「登录」两个按钮——**没有深浅色开关**（切换器在应用外壳里，登录后才看得到）。
但它**尊重**主题：`--keyboard-local` 的四组主题色调走查正是靠设置 `ai-kit-theme`/`ai-kit-accent` 后重载完成的，
焦点环对比度在四组下都达标。

### 三档宽度（不需要凭据）

```
390px:  overflow=0px  inputs=2
768px:  overflow=0px  inputs=2
1440px: overflow=0px  inputs=2
```

登录页在三档下都没有横向溢出，两个输入框都在。

### 复跑：同一检查、同一地址，数值变了（12:33）

工具改动（`--bff -` 归一化、preflight 探针）之后复跑登录页走查，**9 条仍全过**：

```
violet/dark  worst=3.41    （08:00 那次是 3.52）
violet/light worst=17.12
green/dark   worst=9.9     （08:00 那次是 10.4）
green/light  worst=18.49
EXIT=0
```

**两处对比度变了**，其余三条一字不差。地址没变、检查没变，那就是**部署的产物变了**
（并行线在这期间有提交）。这正是「结论带时效」那条规则的具体样子：
不写时间的「已验证」迟早会被当成现在的状态。

两次都远高于 3:1 的焦点指示门槛，所以结论（达标）不变，变的只是数值。

## 缺什么

**mlu370 的账号密码不在仓库里**（也不该在）。拿到凭据后即可：

1. `--probes` 两条 oauth 探针应变绿；
2. 依次跑 `--keyboard-local` → `--locale-scan` → 整轮基线；
3. 那将是**新架构的第一次真实验收**。
