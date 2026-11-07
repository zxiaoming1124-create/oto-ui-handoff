# OTO 界面交付 · B 版

解压后用桌面浏览器打开 **OTO.html**。这个文件已经包含样式、脚本和 Logo，直接打开就能走完整流程。

1. 从欢迎页点 **Get started**，选择口述语言。
2. API key 可以用 `demo` 体验填写状态，也可以选 **Set up later**。
3. 在 **Try OTO** 输入任意文字即可启用主按钮，完成后进入 Settings。侧栏可以切换到 History。
4. 再次浏览时，地址末尾改为 `#welcome` 可以重新走引导。也可直接使用 `#language`、`#api-key`、`#try`、`#settings`、`#history`。

## 给开发者

- 本次定稿为 B 版。四页引导、Settings、History 的字号整体加大 2px；Settings 中 Control 与 Esc 键帽左边缘对齐。
- `index.html` 包含可编辑的页面结构、共享样式和图标，`app.js` 包含界面状态与交互。直接打开 `index.html` 也可从源文件预览。
- 语言选择会同步到 Settings。示例 API key 仅保存在当前页面内存；练习框接受键入文字模拟转写。
- 全局快捷键、系统权限、录音转写、OpenAI 验证和外链请沿用原生程序实现。History 使用样例数据。
- Logo 和原项目署名见 `assets/`。
