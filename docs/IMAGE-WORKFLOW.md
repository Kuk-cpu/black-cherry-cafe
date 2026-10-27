# 原创商品插画

所有菜单商品使用原创代码绘制的贴纸，位于 `public/menu-items/`，不依赖远程照片。每个商品拥有独立 SVG 和 480×360、960×720 WebP；共享杯子、奶泡、冰块、面包和盘子基础组件，同时通过原料、颜色、形状和装饰区分商品。

视觉使用米白、黑樱桃红、咖啡棕、鼠尾草绿，透明背景、圆润描边和一致阴影。商品卡片采用 4:3 和 object-fit: contain，支持懒加载和描述性 alt。WebP 请求失败时加载同一商品的 SVG。

修改 `scripts/illustrations/system.ts` 的图形定义后运行：

```sh
npm run images:illustrate
npm run images:audit
npm run images:report
```

`src/data/imageSources.json` 保存图片登记、尺寸、字节数、哈希及审核记录。新增插画须检查原料匹配、裁剪、颜色和明显区别，并更新审核记录。构建前检查路径、来源登记、大小、比例、透明度、元数据、重复内容及授权状态。所有正式菜单商品必须匹配原创插画。
