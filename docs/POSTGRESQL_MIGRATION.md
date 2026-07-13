# PostgreSQL 迁移指南

## 为什么迁移到 PostgreSQL？

SQLite 适合开发和小规模使用，但生产环境存在以下局限：
- 不支持高并发写入
- 缺乏高级特性（索引优化、分区表、JSONB等）
- 没有用户权限管理
- 不适合水平扩展

## 环境准备

### 1. 安装 PostgreSQL

**Windows:**
- 下载：https://www.postgresql.org/download/windows/
- 安装时设置默认用户 `postgres` 密码为 `postgres`
- 默认端口 `5432`

**Docker (推荐):**
```bash
docker run -d --name iot-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=iot_platform \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. 创建数据库

```sql
CREATE DATABASE iot_platform;
```

## 迁移步骤

### 第一步：安装依赖

```bash
cd backend
npm install
```

### 第二步：生成 Prisma Client

```bash
npm run db:generate:pg
```

### 第三步：推送 Schema 到 PostgreSQL

```bash
npm run db:push:pg
```

### 第四步：迁移数据（SQLite → PostgreSQL）

```bash
npm run db:migrate-to-pg
```

脚本会自动从 SQLite 读取所有数据并写入 PostgreSQL，包括：
- 用户表
- 家庭表
- 房间表
- 设备表
- 场景表
- 定时任务表
- 自动化规则表
- 通知表
- 能耗日志表（分批迁移，支持大数据量）

### 第五步：切换启动方式

修改 `.env`：
```env
DB_PROVIDER=postgresql
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/iot_platform?schema=public"
```

或者使用启动命令直接切换：
```bash
npm run dev:pg
```

## 回滚到 SQLite

如果需要回滚，只需修改 `.env`：
```env
DB_PROVIDER=sqlite
DATABASE_URL="file:./data/iot_platform.db"
```

然后正常启动：
```bash
npm run dev
```

## 性能优化建议

迁移到 PostgreSQL 后，可以进一步优化：

1. **索引优化**：已为 EnergyLog 添加 deviceId 和 recordedAt 索引
2. **分区表**：能耗日志按月分区（大数据量场景）
3. **连接池**：Prisma 默认配置连接池，可根据需要调整
4. **读写分离**：主从复制架构（大规模场景）

## 生产环境注意事项

- 修改默认密码 `postgres` 为强密码
- 配置 PostgreSQL 只监听内网地址
- 定期备份（pg_dump）
- 配置连接池大小（根据服务器内存）
- 监控慢查询并优化
