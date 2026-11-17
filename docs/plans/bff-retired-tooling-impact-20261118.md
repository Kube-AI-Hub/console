# BFF 退役对验证工具的影响（2026-11-18 05:23）

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

## 仍待验证

新路要等部署升级后才能在真实环境验证（当前 `/kapis/oauth.kubesphere.io/v1alpha1/login` 仍 403）。

## 下一步（按顺序）

1. 读 ks-console 侧的转发/登录实现，确认浏览器实际发的登录请求与响应形态；
2. 用浏览器抓一次真实登录（DevTools 或 Playwright 记录请求），据此改 `preflight` 与 `_open_app`；
3. `--bff` 参数可能退化为「与 `--app` 同一个 origin」，配对校验随之简化；
4. 改完先用 `--keyboard-local` 与 `--probes` 验证，再跑整轮基线。

**在那之前，本轮及之后的 `verify-all.sh` 结果都不能当作新架构下的证据。**
