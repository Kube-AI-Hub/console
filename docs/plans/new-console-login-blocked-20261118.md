# 新 console 在当前部署上无法登录（2026-11-18 05:35）

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
