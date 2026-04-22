# Myna Extension

Myna 是一个用 **WXT** 初始化的浏览器插件工程，目标是做成类似沉浸式翻译的 AI 翻译插件。

当前第一版特性：

- 优先支持 **OpenRouter API**
- Popup 中可保存 `API Key / Base URL / Model / 源语言 / 目标语言`
- 点击按钮即可对当前页面执行一轮“沉浸式段落翻译”
- 再点一次可清除插入的译文
- 已用 WXT 搭好 Chrome / Safari 方向的跨浏览器工程骨架

## 开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
pnpm zip
```

## 当前实现说明

这还是一个偏 MVP 的骨架，主要验证三件事：

1. **WXT 工程结构可用**
2. **OpenRouter 调用链通了**
3. **页面段落级插入译文的交互成立**

下一步比较适合继续做：

- 划词翻译
- 悬浮工具栏
- 翻译缓存
- 更多模型 / provider
- 更像沉浸式翻译的双语布局与样式控制
- options 页、快捷键、站点级规则

## OpenRouter

默认 API Base URL：

```txt
https://openrouter.ai/api/v1
```

默认模型：

```txt
google/gemini-2.5-flash-preview
```

你也可以在 popup 里换成别的 OpenRouter 模型。
