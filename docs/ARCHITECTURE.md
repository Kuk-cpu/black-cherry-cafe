# 架构、数据与安全

## 边界

浏览器只初始化 Firebase Web SDK；Admin SDK 仅被 `api/`、`server/`、`scripts/` 引用。生产凭据从环境变量读取。Vite 的 import graph 不包含服务端模块，构建产物不会含 Admin 私钥。公开 Firebase Web 标识是客户端正常工作所必需；Rules 和 API 负责授权。

所有 mutation 通过 `POST /api/service?op=...` 执行。前端 UI 权限不是安全边界；服务端校验 Firebase ID token（含撤销检查），读取活动 `users/{uid}` 角色。客户端无法直接写 Firestore，即使管理员也通过 API。

| op                    | 权限       | 功能                                           |
| --------------------- | ---------- | ---------------------------------------------- |
| order                 | 匿名       | 验证输入、营业状态、分类、商品／选项并生成订单 |
| feedback              | 订单 token | 已完成订单的一次反馈                           |
| me                    | 活动员工   | 当前角色资料                                   |
| update                | 活动员工   | 订单状态、付款与问题标记                       |
| manage / availability | 活动员工   | Available ↔ Sold Out                           |
| manage / save, delete | 管理员     | 产品、分类、门店设置、用户角色                 |

`order` 使用整数澳分，前端提交的总价、单价、未知字段一律拒绝。每个商品支持自己的 modifier groups，各组定义 `required`、`multiple`、选项 ID 与加价。服务端拒绝未知 group／option、重复选项、单选多值和缺少必选项。前端价格是当前菜单估算，最终订单使用服务端事务读取的价格快照。

## 订单事务

1. Zod 校验有限长度的纯文本和数组，API 限制 JSON body 40KB。
2. 以客户端随机 UUID 的 hash 查幂等文档；同 key 同 payload 返回原结果，同 key 不同 payload 返回 409。
3. Firestore 事务读取当前门店设置、所有相关商品和分类；验证营业时间、可用性和价格。
4. 同一事务增加订单计数、创建 `orders`、创建 `publicOrders/{randomToken}`、存储幂等响应。
5. 公共 token 是 Node crypto 生成的 32-byte hex（256-bit），与可读订单编号完全独立。编号全局递增，从 BC-1024 开始。
6. 更新状态时比较 expectedStatus，检查合法状态机；完成必须 Paid。同一事务更新订单、公共投影和审计记录。
7. 超时或断网时，购物车保留原始 pending payload 和 key；重试使用同一份内容，不重复创建订单。长时间页面会话（24小时）拒绝提交。

合法链：`Pending → Confirmed → Preparing → Ready → Completed`。从任意非终态可进入 `Cancelled`，终态不可重新打开。问题／付款标记为独立字段，记录不执行支付网关操作。

## Firestore 集合

金额字段为整数澳分；业务时间字段为 Unix epoch 毫秒；TTL 字段为 Firestore Timestamp。实体内的 `id` 与文档 ID 相同。

| 集合         | 文档 ID / 字段                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| users        | Auth UID；uid, name, email, role(staff/admin), active, createdAt                                                               |
| categories   | id, name, displayOrder, active；扩展 kind(drink/food) 用于饮品销售分母                                                         |
| products     | id, categoryId, name, description, imageUrl, basePrice, modifiers, allergens, tags, status, displayOrder, createdAt, updatedAt |
| settings     | 唯一文档 store；announcement, waitMinutes, acceptingOrders, hours[day,open,close,closed]                                       |
| orders       | 随机 Firestore ID；完整字段见下方                                                                                              |
| publicOrders | publicToken；仅脱敏追踪 projection，禁止 list                                                                                  |
| feedback     | orderId，确保一单一评；id, orderId, rating, tasteRating, valueRating, comment, newProductInterest, createdAt                   |
| counters     | orders 文档的 value，全局原子序号                                                                                              |
| idempotency  | UUID 的 SHA-256；payloadHash, response, expiresAt（48h 过期标记）                                                              |
| rateLimits   | 服务端 HMAC(IP/UID + 操作 + 分钟窗口)；count, expiresAt（2min 过期标记），不存原始 IP                                          |
| audit        | uid, action, 目标实体／订单、变化字段、at；仅 Admin SDK，未开放客户端读取                                                      |

`orders` 包含：id, orderNumber, publicToken, orderType, tableNumber, customerName, source, isFirstVisit, isUsydStudent, items, subtotal, total, paymentMethod, paymentStatus, orderStatus, specialInstructions, sessionStartedAt, submittedAt, acceptedAt, preparingAt, readyAt, completedAt, cancelledAt, remade, refunded, createdAt；扩展 error, waitMinutes, timeline。

`items` 保存下单时商品／选项名称、basePrice、unitPrice、lineTotal、数量、选项 ID、选项展示和加价、备注，以及下单时 isNew/isDrink。后续修改或删除菜单不会改变历史订单金额或新品归属。

`publicOrders` 仅保存 orderNumber, orderType, items, total, paymentMethod, paymentStatus, orderStatus, submittedAt, waitMinutes, timeline；不含昵称、桌号、来源、学生／首次访客调查、员工信息和内部问题标记。商品备注可能含顾客自愿填写的信息，因此追踪 URL 仍需保密。

## 读取策略

- 顾客 products 查询必须限定 status in [Available, Sold Out]；categories 查询必须限定 active == true。
- 顾客可读取门店公告／营业时间，不可读取 users、orders、feedback、campaigns。
- `publicOrders` 只允许格式正确的 64 位十六进制路径单文档 get／监听；禁止 collection list 和 query。
- 活动 staff/admin 可以读取订单和包括 Hidden 在内的菜单；管理员可读取用户列表、反馈和活动。
- 默认禁止其他读取、所有直接写入、用户自行提权。

Firestore 查询规则不是筛选器，所有菜单查询在客户端均加相应约束。测试直接验证未认证读取、伪造订单写入、普通用户访问和 staff 提权均被拒绝。

## 统计定义

所有日界与小时桶使用 `Australia/Sydney`，自动处理夏令时。查询先用保守 UTC 边界，再按悉尼本地日期精确筛选。

- 有效订单：除 Cancelled 外的订单，包含尚未付款与尚未完成订单。
- 提交金额：有效订单 total 之和；平均客单价 = 提交金额 / 有效订单数。
- 堂食／外带、QR 比例、首次到店／USYD 计数只用有效订单；未填写调查保持 null。
- 平均点单时间 = submittedAt − sessionStartedAt（客户端会话开始时间，仅用于参考）。
- 平均制作时间 = readyAt − preparingAt；平均完成时间 = completedAt − submittedAt。缺少任一时间戳的订单不进入该项平均。
- 错单率 = error 或 remade 的订单数 / 全部提交订单数；重做／退款率同样以全部订单为分母。
- 新品饮品销售占比 = 下单快照 isNew && isDrink 的行金额 / 所有 isDrink 行金额。
- 每小时订单量按 submittedAt 分桶；每小时完成量按 completedAt 分桶；高峰为下单量最多的小时。高峰处理能力 = 该小时的完成订单数 / 选定日期里该小时对应的计划营业小时数，支持半小时等部分时段。
- 完成吞吐量 = 该订单日期范围内已完成订单数 / 选定日历日期当前配置的营业小时数。不是员工生产力或历史实际营业能力。

CSV 使用 UTF-8 BOM、字段引用／双引号转义，并中和以 =、+、-、@ 等开头的单元格，减少表格公式注入风险。

## 运维

限流文档使用 Firestore transaction，适用于多个 Vercel 实例，不依赖单进程内存。限流按自然分钟固定窗口，不能代替 WAF。生产 IP 来源于 Vercel 转发头；本地只用 socket IP。Spark 免费项目保留 `expiresAt` 作为运维清理依据，不启用要求结算账号的 Firestore 自动 TTL。

设好预算告警，关注 Firestore 读取量和 API 错误率；菜单和看板使用实时订阅。店员共享网络触发限流时，根据实际峰值调整阈值。不要在服务端日志输出完整顾客 payload、token 或密钥。

API 不支持跨域 CORS，额外校验 Origin 与 APP_ORIGIN；没有 cookie session，员工认证通过 Authorization Bearer token。文本由 React 安全转义，不使用 dangerouslySetInnerHTML；服务端拒绝输入中的 HTML 尖括号，图片必须引用已登记的本地插画路径。HTTP 响应关闭缓存并添加 nosniff、Referrer-Policy 和 frame 限制。
