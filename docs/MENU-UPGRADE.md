# 菜单维护

正式菜单共 68 项：Coffee 17、Non-Coffee 16、Something New 13、All-Day Kitchen 22。`src/data/menu.json` 定义菜单及默认规格，`shared/model.ts` 定义并校验数据结构。顾客页面只从 Firestore 读取菜单。

商品字段包含 id、name、categoryId、description、basePrice（澳分）、imageUrl、imageDetailUrl、imageAlt、modifiers、allergens、dietaryTags、tags、active、available、status、displayOrder、availableFrom、availableUntil。

上下架状态保持一致：Available 对应 active/available 均为 true；Sold Out 对应 true/false；Hidden 对应 false/false。服务器同时更新这些字段。隐藏商品不进入顾客查询；售罄商品保持展示但不能下单。服务端提交事务再次核验可用性和金额。

Something New 是可编辑的正式新品与季节分类。标签支持 New、Limited、Seasonal、Popular；上线与结束时间可留空或由管理员设置。时间保存为 UTC 毫秒，后台显示管理员设备时区。

首次 live-menu-v3 迁移将菜单默认设为在售、可下单，清除旧管理标记和旧预设截止时间，并安装各商品独立插画。后续导入采用上次默认值、当前数据库值、新默认值的三方合并，保留管理员对价格、规格、状态和档期的修改。订单编号、金额及时间记录不变，历史状态转换为当前名称。

管理员新增商品先保存为隐藏状态，选定已登记插画后即可上架。新增插画按 IMAGE-WORKFLOW.md 登记及审核。
