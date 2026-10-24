#!/bin/bash
# ============================================================
# 快速导入数据库初始化脚本
# ============================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/init-schema.sql"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "NestJS Admin 数据库初始化工具"
    echo ""
    echo "使用方法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --host HOST         PostgreSQL 主机地址 (默认: localhost)"
    echo "  -p, --port PORT         PostgreSQL 端口 (默认: 5432)"
    echo "  -U, --username USER     PostgreSQL 用户名 (默认: postgres)"
    echo "  -d, --database DB       数据库名称 (默认: nest-admin)"
    echo "  -f, --force             强制重建（删除现有数据库）"
    echo "  --docker                使用 Docker 容器中的 PostgreSQL"
    echo "  --help                  显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                                      # 使用默认参数"
    echo "  $0 -U myuser -d mydb                    # 指定用户和数据库"
    echo "  $0 --force                              # 强制重建数据库"
    echo "  $0 --docker                             # 使用 Docker"
    echo ""
}

# 默认参数
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="nest-admin"
FORCE_REBUILD=false
USE_DOCKER=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -p|--port)
            DB_PORT="$2"
            shift 2
            ;;
        -U|--username)
            DB_USER="$2"
            shift 2
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_REBUILD=true
            shift
            ;;
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "未知参数: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 检查 SQL 文件是否存在
if [ ! -f "$SQL_FILE" ]; then
    print_error "SQL 文件不存在: $SQL_FILE"
    exit 1
fi

print_info "================================================"
print_info "NestJS Admin 数据库初始化"
print_info "================================================"
print_info "主机: $DB_HOST:$DB_PORT"
print_info "用户: $DB_USER"
print_info "数据库: $DB_NAME"
print_info "Docker: $([ "$USE_DOCKER" = true ] && echo "是" || echo "否")"
print_info "强制重建: $([ "$FORCE_REBUILD" = true ] && echo "是" || echo "否")"
print_info "================================================"
echo ""

# Docker 模式
if [ "$USE_DOCKER" = true ]; then
    print_info "检查 Docker 容器..."

    # 检查容器是否存在
    if docker ps -a --format '{{.Names}}' | grep -q "^nest-admin-db$"; then
        print_info "容器 nest-admin-db 已存在"

        # 检查容器是否运行
        if ! docker ps --format '{{.Names}}' | grep -q "^nest-admin-db$"; then
            print_info "启动容器..."
            docker start nest-admin-db
            sleep 3
        fi
    else
        print_info "创建新的 PostgreSQL 容器..."
        docker run -d \
            --name nest-admin-db \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=postgres \
            -e POSTGRES_DB=nest-admin \
            -p 5432:5432 \
            postgres:16-alpine

        print_info "等待容器启动..."
        sleep 10
    fi

    # 检查数据库是否存在
    DB_EXISTS=$(docker exec nest-admin-db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

    if [ "$DB_EXISTS" = "1" ]; then
        if [ "$FORCE_REBUILD" = true ]; then
            print_warning "删除现有数据库: $DB_NAME"
            docker exec nest-admin-db psql -U postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
            docker exec nest-admin-db psql -U postgres -c "CREATE DATABASE \"$DB_NAME\";"
        else
            print_warning "数据库 $DB_NAME 已存在，将直接导入（表已存在时会跳过）"
        fi
    else
        print_info "创建数据库: $DB_NAME"
        docker exec nest-admin-db psql -U postgres -c "CREATE DATABASE \"$DB_NAME\";"
    fi

    # 导入 SQL
    print_info "导入数据库结构..."
    docker exec -i nest-admin-db psql -U postgres -d "$DB_NAME" < "$SQL_FILE"

    print_success "数据库初始化完成！"
    print_info "连接信息:"
    echo "  postgresql://postgres:postgres@localhost:5432/$DB_NAME"

else
    # 本地模式

    # 检查 psql 是否可用
    if ! command -v psql &> /dev/null; then
        print_error "psql 命令未找到，请安装 PostgreSQL 客户端工具"
        print_info "或使用 --docker 参数在 Docker 中运行"
        exit 1
    fi

    # 设置 PGPASSWORD 环境变量（避免交互式密码输入）
    if [ -z "$PGPASSWORD" ]; then
        print_warning "未设置 PGPASSWORD 环境变量，可能需要手动输入密码"
        echo -n "请输入 PostgreSQL 密码: "
        read -s PGPASSWORD
        export PGPASSWORD
        echo ""
    fi

    # 检查连接
    print_info "检查数据库连接..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c '\q' 2>/dev/null; then
        print_error "无法连接到 PostgreSQL 服务器"
        print_info "请检查:"
        echo "  1. PostgreSQL 服务是否已启动"
        echo "  2. 主机地址和端口是否正确"
        echo "  3. 用户名和密码是否正确"
        echo "  4. 防火墙设置"
        exit 1
    fi

    print_success "数据库连接成功"

    # 检查数据库是否存在
    DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

    if [ "$DB_EXISTS" = "1" ]; then
        if [ "$FORCE_REBUILD" = true ]; then
            print_warning "删除现有数据库: $DB_NAME"
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
        else
            print_warning "数据库 $DB_NAME 已存在，将直接导入（表已存在时会跳过）"
        fi
    else
        print_info "创建数据库: $DB_NAME"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
    fi

    # 导入 SQL
    print_info "导入数据库结构..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

    print_success "数据库初始化完成！"
    print_info "连接信息:"
    echo "  postgresql://$DB_USER:****@$DB_HOST:$DB_PORT/$DB_NAME"
fi

echo ""
print_info "================================================"
print_info "下一步操作"
print_info "================================================"
echo "1. 配置数据库连接（config/development.local.yaml）:"
echo ""
echo "   database:"
if [ "$USE_DOCKER" = true ]; then
    echo "     url: postgresql://postgres:postgres@localhost:5432/$DB_NAME?schema=public"
else
    echo "     url: postgresql://$DB_USER:PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"
fi
echo ""
echo "2. 创建超级管理员账号:"
echo ""
echo "   npm run bootstrap:superadmin"
echo ""
echo "3. 启动应用:"
echo ""
echo "   npm run start:dev"
echo ""
print_success "初始化完成！"
