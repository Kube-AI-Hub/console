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

## 缺什么

**mlu370 的账号密码不在仓库里**（也不该在）。拿到凭据后即可：

1. `--probes` 两条 oauth 探针应变绿；
2. 依次跑 `--keyboard-local` → `--locale-scan` → 整轮基线；
3. 那将是**新架构的第一次真实验收**。
