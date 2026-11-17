# 390px 下页头溢出 10px（2026-11-18）

## 现象

`test_TC_L2_KUBE_FRONTEND_THEME_02` 在 A100 与 B200 **都失败**，断言是：

```
assert overflow is False     # documentElement.scrollWidth > innerWidth
```

## 定位

390×780 视口下打开配置字典页：

```
scrollWidth: 400   innerWidth: 390      ← 溢出 10px
overflowing: ['ml-auto flex items-center gap-1 right=400',
              'shell:user-menu right=400']
```

表格那几行（`right=467`）在横向滚动容器里，属预期；**真正的溢出源是页头右侧那一组**
（`ml-auto` 容器与 `shell:user-menu` 都到 400px）。

## 结论

- 这是**真实布局缺陷**，不是环境问题（两个环境同样失败）；
- 出现在页头，属于 shell 的改动范围（本轮之前页头没有这两个控件时该用例是通过的）；
- 本轮只记录证据，未改 shell——那是并行线正在改的文件，避免冲突。

## 修法

右侧控件组在 390px 下占 216→400（5 个控件 168px + 4 个 4px 间距 = 184px）。
其中**帮助菜单**最不主要（文档入口在用户菜单里也有），所以在 `sm` 以下收起——与模块导航在 `md` 以下收起的同一个思路：

```diff
- className="inline-flex h-11 items-center rounded-ai-md px-2 … sm:h-9"
+ className="hidden h-11 items-center rounded-ai-md px-2 … sm:inline-flex sm:h-9"
```

## 修复后

```
scrollWidth: 390   innerWidth: 390      ← 页面级溢出消失
```

剩下被列出的 `right=467` 是表格本体，位于横向滚动容器内（预期行为）。

## E2E 复跑的阻塞

`THEME_02` 的复跑被另一处改动挡住：E2E helper 的登录端点已换成
`/kapis/oauth.kubesphere.io/v1alpha1/login`，在当前部署上返回 **403**（并行线正在改这个 helper）。
所以本轮的验证依据是上面的直接测量，不是 E2E 通过。
