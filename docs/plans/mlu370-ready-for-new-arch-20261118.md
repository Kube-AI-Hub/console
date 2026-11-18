# mlu370 已经是新架构，可直接验收（2026-11-18 07:05）

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

## 对验收的意义

「等重构完毕再测试」这件事在 mlu370 上**已经可以开始**：

```bash
cd console/tests/ui
python3 tools/multicluster_sweep.py --env-file <mlu370 的 env> \
  --app https://ka.watering.ai --bff - --probes --clusters host
```

`--bff -` 表示应用与接口同源（新形态），工具已支持（见[影响记录](bff-retired-tooling-impact-20261118.md)）。

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

## 缺什么

**mlu370 的账号密码不在仓库里**（也不该在）。拿到凭据后即可：

1. `--probes` 两条 oauth 探针应变绿；
2. 依次跑 `--keyboard-local` → `--locale-scan` → 整轮基线；
3. 那将是**新架构的第一次真实验收**。
