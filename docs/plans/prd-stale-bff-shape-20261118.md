# PRD 里的部署形态仍写着 BFF（2026-11-18）

`4ff017afa` 之后新 console 由 ks-console 直接提供，但 `prd/kube-frontend/integration/` 仍在描述旧形态。

## 具体位置

| 文件:行 | 现文 | 实际 |
| --- | --- | --- |
| `_index.md:39` | 新前端是独立 Deployment，一个容器同时提供静态产物与 BFF | 由 ks-console 提供，无独立容器 |
| `_index.md:47` | 架构图：`静态 + BFF` | 由 ks-console 提供静态产物 |
| `_index.md:64` | `/kube-frontend/api/session/*` → 新前端 BFF | 登录改为 `POST /kapis/oauth.kubesphere.io/v1alpha1/login` |
| `_index.md:65` | `/kube-frontend/kapis/*` → 新前端 BFF → ks-apiserver | ks-console 自己转发 |
| `mount.md:5,25` | 剥前缀后交给新前端的 BFF | 同上 |
| `session.md:35` | 登录失败文案由 BFF 的 `code` 决定 | 由 ks-apiserver 的登录响应决定 |

## 为什么本轮不改

这是**设计文档**，改它等于替并行线重新定义部署形态。他们正在推进部署（overlay 镜像、`/oauth` 转发、SPA 挂载顺序），
形态可能还会调整。**先记录差异，由设计方统一改写更合适。**

## 建议改法

1. `_index.md` 的架构图与转发表按「ks-console 直接提供 + 自己转发」重画；
2. `mount.md` 的前缀剥离叙述改为 ks-console 内部路由；
3. `session.md` 的登录路径与错误来源改为 `/kapis/oauth.kubesphere.io/v1alpha1/login`；
4. 对应 AC 里的请求路径断言同步更新，否则用例会断言一条不存在的路由。
