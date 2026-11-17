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

## 建议

页头在窄屏下让右侧控件组换行或收起次要控件（语言/主题/用户菜单），保证 `scrollWidth <= innerWidth`。
