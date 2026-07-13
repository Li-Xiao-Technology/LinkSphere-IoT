# LinkSphere-IoT 智能设备控制平台

[![License: Community + Commercial](https://img.shields.io/badge/license-Community%20%2B%20Commercial-blue.svg)](#license--授权)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node.js-%2343853D.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg)](https://reactjs.org/)

一个统一管理多品牌智能设备、工业 PLC 和物联网传感器的 Web 应用平台，支持消费级智能家居与工业级设备控制，提供跨品牌设备的集中监控、自动化控制与能耗管理。

---

## 项目简介

### 是什么
物联网智能设备聚合控制平台（Web App + PWA）—— 通过单一界面管理家中或工厂中的所有智能设备，涵盖消费级智能家居与工业级 PLC、传感器控制。

### 面向谁
- 拥有多品牌智能设备（米家、海尔、美的、Yeelight 等）的家庭用户
- 需要统一管控设备的房东、商铺经营者
- 小型工厂、机房、农业大棚等需要 PLC 监控的工业场景
- 系统集成商、自动化工程师

### 双赛道定位
| 赛道 | 消费级智能家居 | 工业级控制 |
|------|-------------|-----------|
| 协议 | 米家 / 海尔 / 美的 / Yeelight BLE | Modbus TCP / S7 / MQTT |
| 典型设备 | 灯、空调、净化器、传感器 | PLC、传感器、执行器、MQTT设备 |
| 核心价值 | 便捷、自动化、节能 | 远程监控、数据采集、趋势分析 |

---

## 功能特性

### 设备管理
- **多协议接入**：米家（OAuth）、海尔 U+、美的美居、Yeelight BLE、Modbus TCP、西门子 S7、MQTT
- **设备分组管理**：自定义分组、图标、颜色，批量分配设备到分组，分组批量控制
- **批量设备操作**：批量开关、批量分配房间/分组/标签、批量删除、批量固件升级
- **PLC 支持**：S7-200 SMART 等兼容 Modbus TCP / S7 协议的 PLC 设备
- **蓝牙设备**：支持 Yeelight 蓝牙设备（如 XMCTD01YL 床头灯）的自动发现、配对与控制
- **寄存器映射**：可配置的寄存器地址映射，支持 bool / uint16 / int16 / float32 等数据类型
- **PLC 趋势图**：SVG 实时趋势图表，支持寄存器历史数据可视化
- **调试终端**：在线读写寄存器，Float32 实时解析
- **设备状态实时同步**（WebSocket 推送 + 轮询双机制）
- **设备状态历史**：可视化展示设备状态变化历史（在线率、开关状态等趋势图）
- **固定尺寸设备卡片**：一致的 300x360px 卡片布局，支持开关、滑块、传感器数据显示
- **设备重命名**：支持通过设备卡片菜单快速重命名

### 自动化引擎
- **规则引擎**：条件触发（时间、设备状态、传感器数据）
- **动作执行**：设备控制、场景触发、通知推送
- **规则可视化配置**
- **规则执行历史**：触发记录与结果追溯

### 场景与定时
- **场景管理**：一键执行多设备动作
- **场景模板**：回家、离家、睡眠、观影等预设
- **智能场景推荐**：基于设备使用模式自动生成场景建议，一键应用
- **定时任务**（Cron 表达式）
- **周期性任务调度**

### 空间与组织
- **房间管理**：按空间分组设备
- **家庭管理**：多家庭切换
- **多成员协作**：邀请家庭成员、分配角色
- **设备分享**：临时分享设备给他人

### 自定义仪表盘
- **拖拽式布局**：自由添加、排列、调整大小
- **多种组件类型**：设备状态概览、快捷开关、数据统计、实时图表
- **多仪表盘支持**：创建多个仪表盘，满足不同场景需求

### 固件管理中心
- **固件版本管理**：上传、发布、归档固件版本
- **设备兼容性**：管理固件支持的设备品牌和型号
- **批量升级任务**：创建升级计划，批量推送固件
- **升级状态追踪**：实时监控升级进度和结果

### 多租户管理
- **组织管理**：创建和管理多个组织（租户）
- **成员邀请**：通过邮箱或链接邀请成员加入组织
- **角色分配**：组织内成员角色管理
- **数据隔离**：租户间数据完全隔离

### 权限系统
- **RBAC 角色权限**：管理员 / 成员 / 访客 / 自定义角色
- **细粒度权限控制**：设备管理、规则管理、能耗查看等
- **前后端双重校验**

### 能耗管理
- **设备能耗实时记录**
- **能耗数据可视化图表**
- **能耗统计与分析**（日/周/月维度）
- **能耗预测**：基于历史数据的 AI 预测
- **用电建议与优化策略**

### AI 与交互
- **智能聊天助手**：自然语言控制设备、查询状态
- **语音控制**：语音指令转设备操作
- **全局搜索**：设备、场景、规则快速定位

### 通知系统
- **实时消息推送**（Socket.io）
- **外部通知渠道**：Webhook、邮件、钉钉、企业微信、飞书、Slack、Telegram 等
- **通知中心管理**
- **通知偏好设置**：自定义接收哪些通知

---

## 技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 4.x | 类型安全 |
| Zustand | 5.x | 状态管理 |
| Socket.io Client | 4.x | 实时通信 |
| PWA | - | 离线访问 + 桌面安装 |
| React Scripts | 5.x | 构建工具 |

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Express | 4.x | Web 框架 |
| TypeScript | 5.x | 类型安全 |
| Prisma | 6.x | ORM 数据库访问 |
| SQLite / PostgreSQL | - | 数据库（双引擎支持） |
| Socket.io | 4.x | 实时通信 |
| JWT | 9.x | 身份认证（双 Token 机制） |
| BCrypt | 5.x | 密码加密 |
| Node-Cron | 3.x | 定时任务 |
| jsmodbus | 4.x | Modbus TCP 协议 |
| nodes7 | - | 西门子 S7 协议 |
| noble-winrt | - | Windows 蓝牙 BLE 通信 |
| mqtt | 5.x | MQTT 协议支持 |
| Swagger UI | - | API 文档（`/api-docs`） |

### 协议适配
- **米家协议**：米家开放平台 API + OAuth 认证
- **海尔协议**：海尔 U+ 开放平台
- **美的协议**：美的美居开放平台
- **Yeelight BLE**：蓝牙 GATT 通信，支持开关、亮度、色温、延时关灯、模式切换
- **Modbus TCP**：工业标准协议，支持 01/02/03/04/05/06/15/16 功能码
- **西门子 S7**：S7-200 SMART 等 PLC 直接通信
- **MQTT**：物联网设备消息协议

---

## 项目结构

```
IOT/
├── backend/                    # 后端服务
│   ├── prisma/                 # 数据库 Schema
│   │   ├── schema.prisma       # SQLite 主 Schema
│   │   ├── schema.postgresql.prisma  # PostgreSQL Schema
│   │   └── migrations/         # 数据库迁移
│   ├── src/
│   │   ├── managers/           # 核心管理器
│   │   │   ├── DeviceManager.ts       # 设备管理
│   │   │   ├── EnergyManager.ts       # 能耗管理
│   │   │   ├── NotificationManager.ts # 通知管理
│   │   │   ├── RuleEngine.ts          # 规则引擎
│   │   │   ├── ScheduleManager.ts     # 定时任务
│   │   │   └── PredictionService.ts   # 能耗预测
│   │   ├── middleware/         # 中间件
│   │   │   ├── auth.ts         # JWT 认证
│   │   │   ├── permission.ts   # 权限校验
│   │   │   └── rateLimit.ts    # 限流 + 登录保护
│   │   ├── protocols/          # 协议适配器
│   │   │   ├── ProtocolManager.ts     # 协议管理器
│   │   │   ├── ModbusTCPAdapter.ts    # Modbus TCP
│   │   │   ├── S7Adapter.ts           # 西门子 S7
│   │   │   ├── MqttAdapter.ts         # MQTT
│   │   │   ├── YeelightBLEAdapter.ts  # Yeelight 蓝牙
│   │   │   ├── MijiaAdapter.ts        # 米家
│   │   │   ├── HaierAdapter.ts        # 海尔
│   │   │   └── MideaAdapter.ts        # 美的
│   │   ├── routes/             # API 路由
│   │   │   ├── deviceGroup.ts         # 设备分组管理
│   │   │   ├── dashboard.ts           # 自定义仪表盘
│   │   │   ├── notificationChannel.ts # 外部通知渠道
│   │   │   ├── batch.ts               # 批量设备操作
│   │   │   ├── firmwareCenter.ts      # 固件管理中心
│   │   │   ├── sceneRecommendation.ts # 智能场景推荐
│   │   │   └── organization.ts        # 多租户组织管理
│   │   ├── types/              # 类型定义
│   │   ├── utils/              # 工具函数
│   │   │   ├── logger.ts       # 分级日志（debug/info/warn/error）
│   │   │   └── tokenStore.ts   # Token 黑名单 + 登录限流
│   │   ├── server.ts           # 服务器入口
│   │   └── socket.ts           # Socket.io 配置
│   ├── .env                    # 环境变量
│   └── package.json
├── frontend/                   # 前端应用
│   ├── public/                 # 静态资源
│   ├── src/
│   │   ├── api/                # API 请求封装
│   │   ├── components/         # React 组件
│   │   ├── store/              # Zustand 状态管理
│   │   └── App.tsx             # 主应用
│   └── package.json
├── docker-compose.yml          # Docker Compose 部署配置
├── LICENSE                     # 社区非商用许可协议
├── COMMERCIAL-LICENSE.md       # 商业授权说明
└── README.md
```

---

## 快速开始

### 环境要求
- Node.js >= 18.x
- npm >= 10.x
- SQLite 3（默认）或 PostgreSQL 14+（可选）

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 配置环境变量

复制环境变量模板并按需修改：

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**`backend/.env` 关键变量说明：**

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 是 | JWT 签名密钥，至少 32 位。生产环境用 `openssl rand -hex 32` 生成 |
| `ENCRYPTION_KEY` | 是 | 设备凭据加密密钥，生产环境必须独立设置 |
| `DATABASE_URL` | 是 | `file:./data/iot_platform.db`（SQLite）或 PostgreSQL 连接串 |
| `DB_PROVIDER` | 否 | `sqlite` 或 `postgresql` |
| `FRONTEND_URL` | 否 | 允许的前端来源，多个用逗号分隔 |
| `API_BASE_URL` | 否 | Swagger UI 显示的服务地址 |
| `INITIAL_ADMIN_PASSWORD` | 首次 seed 时 | 至少 8 位字符，仅用于创建初始管理员 |

**`frontend/.env` 关键变量说明：**

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `REACT_APP_SOCKET_URL` | 否 | WebSocket 后端地址。空值时使用当前 origin（同源部署） |

### 初始化数据库

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

### 启动服务

```bash
# 启动后端服务（端口 3001）
cd backend
npm run dev

# 启动前端服务（端口 3000）
cd ../frontend
npm start
```

### 访问应用

打开浏览器访问：http://localhost:3000

**默认账户**：
- 用户名：`admin`
- 密码：`123456`

> ⚠️ **重要**：首次登录后请立即修改密码！

API 文档：http://localhost:3001/api-docs

---

## Docker 部署

```bash
# 构建并启动所有服务
docker-compose up --build

# 后台运行
docker-compose up -d
```

---

## API 接口概览

### 认证接口
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/refresh | 刷新 Token |
| POST | /api/auth/logout | 退出登录 |

### 设备接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/devices | 获取设备列表 |
| GET | /api/devices/:id | 获取设备详情 |
| GET | /api/devices/:id/state | 获取设备状态 |
| PUT | /api/devices/:id/state | 控制设备 |
| PUT | /api/devices/:id/name | 重命名设备 |
| DELETE | /api/devices/:id | 删除设备 |
| POST | /api/devices/discover | 设备发现 |

### 设备分组接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/device-groups | 获取分组列表 |
| POST | /api/device-groups | 创建分组 |
| PUT | /api/device-groups/:id | 更新分组 |
| DELETE | /api/device-groups/:id | 删除分组 |
| POST | /api/device-groups/:id/devices | 批量添加设备到分组 |
| DELETE | /api/device-groups/:id/devices/:deviceId | 从分组移除设备 |
| POST | /api/device-groups/:id/action | 分组批量控制 |

### 批量操作接口
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/batch/power | 批量开关设备 |
| POST | /api/batch/action | 批量执行动作 |
| POST | /api/batch/assign-room | 批量分配房间 |
| POST | /api/batch/assign-group | 批量分配分组 |
| POST | /api/batch/assign-tags | 批量分配标签 |
| POST | /api/batch/delete | 批量删除设备 |
| POST | /api/batch/update-firmware | 批量更新固件 |

### Modbus / PLC 接口
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/modbus/devices | 添加 Modbus 设备 |
| POST | /api/modbus/scan | 扫描网络设备 |
| GET | /api/modbus/devices/:deviceId/registers | 获取寄存器映射 |
| PUT | /api/modbus/devices/:deviceId/registers | 更新寄存器映射 |
| POST | /api/modbus/devices/:deviceId/read | 读寄存器 |
| POST | /api/modbus/devices/:deviceId/write | 写寄存器 |
| GET | /api/plc/devices/:deviceId/history/trend | PLC 趋势数据 |

### Yeelight BLE 接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/yeelight-ble/discover | 发现蓝牙设备 |
| POST | /api/yeelight-ble/devices | 添加蓝牙设备 |
| POST | /api/yeelight-ble/devices/:id/pair | 配对蓝牙设备 |
| GET | /api/yeelight-ble/devices/:id/state | 获取设备状态 |
| POST | /api/yeelight-ble/devices/:id/state | 控制设备 |

### MQTT 接口
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/mqtt/devices | 添加 MQTT 设备 |
| GET | /api/mqtt/devices/:deviceId/state | 获取设备状态 |
| POST | /api/mqtt/devices/:deviceId/state | 控制设备 |

### 仪表盘接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/dashboards | 获取仪表盘列表 |
| POST | /api/dashboards | 创建仪表盘 |
| PUT | /api/dashboards/:id | 更新仪表盘 |
| DELETE | /api/dashboards/:id | 删除仪表盘 |
| POST | /api/dashboards/:id/widgets | 添加组件 |
| PUT | /api/dashboards/:id/widgets/:widgetId | 更新组件 |
| DELETE | /api/dashboards/:id/widgets/:widgetId | 删除组件 |

### 通知渠道接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/notification-channels | 获取渠道列表 |
| POST | /api/notification-channels | 创建渠道 |
| PUT | /api/notification-channels/:id | 更新渠道 |
| DELETE | /api/notification-channels/:id | 删除渠道 |
| POST | /api/notification-channels/:id/test | 测试渠道 |

### 固件管理接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/firmware | 获取固件列表 |
| POST | /api/firmware | 上传固件 |
| PUT | /api/firmware/:id | 更新固件信息 |
| DELETE | /api/firmware/:id | 删除固件 |
| POST | /api/firmware/:id/upgrade | 创建升级任务 |
| GET | /api/firmware/upgrades | 获取升级任务列表 |

### 场景推荐接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/scene-recommendations | 获取推荐列表 |
| POST | /api/scene-recommendations | 生成新推荐 |
| POST | /api/scene-recommendations/:id/apply | 应用推荐为场景 |
| DELETE | /api/scene-recommendations/:id | 忽略推荐 |

### 多租户（组织）接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/organizations | 获取组织列表 |
| POST | /api/organizations | 创建组织 |
| PUT | /api/organizations/:id | 更新组织 |
| DELETE | /api/organizations/:id | 删除组织 |
| POST | /api/organizations/:id/members | 邀请成员 |
| PUT | /api/organizations/:id/members/:userId | 更新成员角色 |
| DELETE | /api/organizations/:id/members/:userId | 移除成员 |
| POST | /api/organizations/:id/switch | 切换当前组织 |

完整 API 文档可在启动后端后访问：`http://localhost:3001/api-docs`

---

## 认证与权限

### JWT 双 Token 机制
- **Access Token**：短期有效，用于 API 请求认证
- **Refresh Token**：长期有效，用于刷新 Access Token，支持黑名单机制

### 权限模型
采用 RBAC（基于角色的访问控制）：
- 内置角色：`owner`、`admin`、`member`、`guest`
- 支持自定义角色和权限组合
- 前后端双重校验
- 登录限流保护（5 次失败后锁定 15 分钟）

---

## 实时通信

### Socket.io 事件

#### 服务端推送
| 事件名 | 数据类型 | 描述 |
|--------|----------|------|
| deviceStateChanged | { deviceId, state } | 设备状态变化 |
| notification | Notification | 新通知 |
| energyUpdate | EnergyLog | 能耗更新 |
| ruleTriggered | { ruleId, result } | 规则触发 |

#### 客户端发送
| 事件名 | 数据类型 | 描述 |
|--------|----------|------|
| authenticate | { token } | 身份认证 |
| deviceControl | { deviceId, action, params } | 设备控制 |

---

## 协议适配器

### 架构设计
采用适配器模式，将不同品牌的设备协议统一为标准接口：

```typescript
interface ProtocolAdapter {
  discoverDevices(): Promise<Device[]>;
  getDeviceState(deviceId: string): Promise<DeviceState>;
  controlDevice(deviceId: string, action: string, params: Record<string, unknown>): Promise<void>;
  subscribe(deviceId: string, callback: (state: DeviceState) => void): void;
  unsubscribe(deviceId: string): void;
}
```

### 支持的协议
| 协议 | 适配器 | 典型设备 |
|------|--------|----------|
| 米家（OAuth） | MijiaOAuthAdapter | 小米生态智能设备 |
| 海尔 U+ | HaierAdapter | 海尔智能家电 |
| 美的美居 | MideaAdapter | 美的智能家电 |
| Yeelight BLE | YeelightBLEAdapter | Yeelight 蓝牙灯 |
| Modbus TCP | ModbusTCPAdapter | PLC、工业传感器 |
| 西门子 S7 | S7Adapter | S7-200 SMART PLC |
| MQTT | MqttAdapter | 物联网传感器 |

---

## 数据库模型

共 27+ 个数据模型，涵盖：
- **用户与组织**：User、Household、UserHousehold、Organization、OrganizationMember
- **设备**：Device、DeviceStateHistory、DeviceShare、PlcRegisterHistory、DeviceGroup、DeviceGroupRelation
- **自动化**：Rule、RuleExecutionHistory、Scene、SceneTemplate、Schedule、SceneRecommendation
- **仪表盘**：Dashboard、DashboardWidget
- **能耗**：EnergyLog
- **通知**：Notification、NotificationPreference、NotificationChannel、NotificationLog
- **权限**：Permission、RolePermission、UserPermission
- **空间**：Room
- **固件**：Firmware、FirmwareUpgrade

---

## PWA 支持

- **离线访问**：Service Worker 缓存静态资源和 API 数据
- **桌面图标安装**：支持安装为桌面应用
- **推送通知**：支持浏览器推送通知（需用户授权）
- **后台同步**：设备状态后台同步，网络恢复后自动更新
- **版本更新提示**：检测到新版本时自动提示用户更新
- **响应式设计**：适配手机、平板、桌面多种屏幕尺寸

---

## 数据库切换

项目同时支持 SQLite 和 PostgreSQL。

### 默认：SQLite
开箱即用，适合开发和小规模部署。

### 切换到 PostgreSQL

```bash
# 1. 设置环境变量
export DB_PROVIDER=postgresql
export DATABASE_URL="postgresql://user:password@localhost:5432/iot_platform"

# 2. 生成 Prisma Client
npx prisma generate --schema=prisma/schema.postgresql.prisma

# 3. 推送 Schema
npx prisma migrate deploy --schema=prisma/schema.postgresql.prisma
```

详细迁移指南见 [docs/POSTGRESQL_MIGRATION.md](docs/POSTGRESQL_MIGRATION.md)

---

## 开发模式

### 后端开发
```bash
cd backend
npm run dev  # nodemon 自动重启
```

### 前端开发
```bash
cd frontend
npm start    # 热重载
```

### 构建生产版本
```bash
# 构建后端
cd backend
npm run build

# 构建前端
cd ../frontend
npm run build
```

---

## License / 授权

Copyright © 2026 Lixiao

本项目采用 **双许可证模式**：

1. **社区许可**：允许个人学习、技术研究、本地非商业部署和非商业二次修改，具体条款见 [LICENSE](LICENSE)。
2. **商业许可**：任何商业经营、项目交付、SaaS 服务、产品内嵌、二次销售、外包交付、企业内部生产环境使用，均需提前取得商业授权，具体条款以双方签署的商业授权协议为准。详见 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)。
3. **商业授权联系**：lixiao@acyam.top

> 注意：除非另有书面授权，本项目完整代码 **不以 Apache License 2.0 授权商业使用**。本项目不再附带 Apache License 2.0 参考文本；实际授权以 LICENSE 和 COMMERCIAL-LICENSE.md 为准。
