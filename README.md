# Black Cherry Café — QR Ordering

面向顾客、员工和管理员的咖啡店点单系统。顾客扫码浏览菜单、选择规格和加料、提交订单并实时追踪；员工接单、更新制作状态和售罄信息；管理员管理菜单、营业时间、员工、二维码与经营统计。付款方式为 Pay at Counter。

## 菜单与插画

68 个商品分为 Coffee（17）、Non-Coffee（16）、Something New（13）、All-Day Kitchen（22）。每个商品使用独立原创手绘贴纸，包含 SVG、480px 和 960px 透明 WebP。价格以整数澳分存储，界面显示 `$X.XX`。

菜单定义位于 `src/data/menu.json`，通过 `scripts/seed.ts` 导入 Firestore。页面实时读取数据库；管理员可修改名称、价格、描述、分类、插画、规格、加料、饮食标签、商品标签、排序、上下架、售罄及新品档期。

订单状态：Pending → Confirmed → Preparing → Ready → Completed；未完成订单可取消。订单编号由数据库事务生成，重复提交使用幂等键去重。历史订单保存下单时的价格和选项快照。

## 本地运行

需要 Node.js 22.12+ 和 Firebase Emulator 所需的 Java 环境。

```sh
npm ci
cp .env.example .env
npm run emulators
```

在其他终端执行：

```sh
npm run seed
npm run accounts:local
npm run dev
```

打开 `http://localhost:5173/order`；员工入口 `/staff`。本地账户由 `scripts/local-accounts.ts` 创建，仅允许连接本地模拟器。此脚本会将本地营业时间设为全天，以便验证下单流程；正式门店时间通过后台设置。

## 验证

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:e2e
npm run build
```

集成和浏览器测试需要本地 Firebase、已导入菜单及本地账户。具体结果见 [验证记录](docs/VERIFICATION.md)。

## 部署

见 [部署步骤](docs/DEPLOYMENT.md)。正式部署必须使用云 Firebase 项目、服务端凭据和 HTTPS 域名；`npm run build:production` 校验配置后构建。Vercel 构建会自动执行同样的配置检查，禁止使用模拟器连接。

- [数据与权限架构](docs/ARCHITECTURE.md)
- [菜单维护与迁移](docs/MENU-UPGRADE.md)
- [插画维护](docs/IMAGE-WORKFLOW.md)
- [插画登记表](docs/image-sources.md)
