# 正式部署

1. 在 Firebase 创建云项目、Firestore 数据库和 Web App，启用 Email/Password 登录。在 Authentication 中添加正式域名。
2. 复制 `.env.production.example` 为 `.env.production`，填写 Web App 标识、同项目的服务账户 email/private key、32 字符以上随机限流密钥和 HTTPS 站点 origin。私钥换行使用 `\n`；服务端凭据不能使用 VITE_ 前缀。模拟器变量保持为空。环境文件不提交版本库。
3. 运行 `npm run build:production`，检查配置、图片、TypeScript 和生产构建。该检查校验配置结构；项目访问权限以实际 Firebase 操作为准。
4. 使用 Firebase CLI 登录并部署规则与索引：`npx firebase deploy --only firestore:rules,firestore:indexes --project <project-id>`。
5. 导入正式菜单：`node --env-file=.env.production --import tsx scripts/seed.ts`。迁移会保留历史订单；首次升级将 68 个菜单商品设为在售，后续导入保留管理员修改。
6. 在安全的本地环境设置 ADMIN_EMAIL、ADMIN_PASSWORD（至少12字符）、ADMIN_NAME，再运行 `node --env-file=.env.production --import tsx scripts/create-admin.ts` 创建管理员。
7. 将项目部署到 Vercel，使用项目自带 `vercel.json`。在 Vercel 环境设置同一组配置，Build Command 为 `npm run build:production`，Output Directory 为 `dist`。服务端凭据仅保存在服务器环境。不要上传 `.env` 或运行本地账户脚本。
8. 绑定 HTTPS 域名并让 APP_ORIGIN 与其一致。在管理员后台核对营业时间、商品和员工账户，再生成指向正式域名的桌面二维码。
9. 在正式域名验证一次下单、员工接单、状态更新、取消、售罄同步和后台编辑；确认 Firestore Rules 拒绝匿名直接写入。检查 Vercel 日志和 Firebase 读取预算。

系统支持柜台付款；部署不会自动配置在线收款或 POS。商品状态、订单状态和付款状态分别管理。
