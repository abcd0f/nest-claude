@echo off
REM ============================================================
REM NestJS Admin 数据库快速导入脚本 (Windows)
REM ============================================================

setlocal enabledelayedexpansion

REM 默认参数
set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=postgres
set DB_NAME=nest-admin
set FORCE_REBUILD=false
set USE_DOCKER=false

REM 脚本目录
set SCRIPT_DIR=%~dp0
set SQL_FILE=%SCRIPT_DIR%init-schema.sql

REM 解析命令行参数
:parse_args
if "%~1"=="" goto start_import
if /i "%~1"=="-h" set DB_HOST=%~2& shift& shift& goto parse_args
if /i "%~1"=="--host" set DB_HOST=%~2& shift& shift& goto parse_args
if /i "%~1"=="-p" set DB_PORT=%~2& shift& shift& goto parse_args
if /i "%~1"=="--port" set DB_PORT=%~2& shift& shift& goto parse_args
if /i "%~1"=="-U" set DB_USER=%~2& shift& shift& goto parse_args
if /i "%~1"=="--username" set DB_USER=%~2& shift& shift& goto parse_args
if /i "%~1"=="-d" set DB_NAME=%~2& shift& shift& goto parse_args
if /i "%~1"=="--database" set DB_NAME=%~2& shift& shift& goto parse_args
if /i "%~1"=="-f" set FORCE_REBUILD=true& shift& goto parse_args
if /i "%~1"=="--force" set FORCE_REBUILD=true& shift& goto parse_args
if /i "%~1"=="--docker" set USE_DOCKER=true& shift& goto parse_args
if /i "%~1"=="--help" goto show_help
echo [ERROR] 未知参数: %~1
goto show_help

:show_help
echo NestJS Admin 数据库初始化工具 (Windows)
echo.
echo 使用方法:
echo   %~nx0 [选项]
echo.
echo 选项:
echo   -h, --host HOST         PostgreSQL 主机地址 (默认: localhost)
echo   -p, --port PORT         PostgreSQL 端口 (默认: 5432)
echo   -U, --username USER     PostgreSQL 用户名 (默认: postgres)
echo   -d, --database DB       数据库名称 (默认: nest-admin)
echo   -f, --force             强制重建（删除现有数据库）
echo   --docker                使用 Docker 容器中的 PostgreSQL
echo   --help                  显示此帮助信息
echo.
echo 示例:
echo   %~nx0                                      # 使用默认参数
echo   %~nx0 -U myuser -d mydb                    # 指定用户和数据库
echo   %~nx0 --force                              # 强制重建数据库
echo   %~nx0 --docker                             # 使用 Docker
echo.
goto :eof

:start_import
REM 检查 SQL 文件是否存在
if not exist "%SQL_FILE%" (
    echo [ERROR] SQL 文件不存在: %SQL_FILE%
    exit /b 1
)

echo ================================================
echo NestJS Admin 数据库初始化
echo ================================================
echo 主机: %DB_HOST%:%DB_PORT%
echo 用户: %DB_USER%
echo 数据库: %DB_NAME%
echo Docker: %USE_DOCKER%
echo 强制重建: %FORCE_REBUILD%
echo ================================================
echo.

if "%USE_DOCKER%"=="true" goto docker_mode

REM ============================================================
REM 本地模式
REM ============================================================

:local_mode
echo [INFO] 检查 psql 命令...
where psql >nul 2>&1
if errorlevel 1 (
    echo [ERROR] psql 命令未找到，请安装 PostgreSQL 客户端工具
    echo [INFO] 下载地址: https://www.postgresql.org/download/windows/
    echo [INFO] 或使用 --docker 参数在 Docker 中运行
    exit /b 1
)

echo [SUCCESS] psql 命令已找到

REM 设置密码环境变量
if not defined PGPASSWORD (
    echo [WARNING] 未设置 PGPASSWORD 环境变量
    set /p PGPASSWORD=请输入 PostgreSQL 密码:
)

echo [INFO] 检查数据库连接...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -c "\q" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 无法连接到 PostgreSQL 服务器
    echo [INFO] 请检查:
    echo   1. PostgreSQL 服务是否已启动
    echo   2. 主机地址和端口是否正确
    echo   3. 用户名和密码是否正确
    echo   4. 防火墙设置
    exit /b 1
)

echo [SUCCESS] 数据库连接成功

REM 检查数据库是否存在
for /f "delims=" %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'"') do set DB_EXISTS=%%i

if "%DB_EXISTS%"=="1" (
    if "%FORCE_REBUILD%"=="true" (
        echo [WARNING] 删除现有数据库: %DB_NAME%
        psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -c "DROP DATABASE IF EXISTS \"%DB_NAME%\";"
        psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -c "CREATE DATABASE \"%DB_NAME%\";"
    ) else (
        echo [WARNING] 数据库 %DB_NAME% 已存在，将直接导入（表已存在时会跳过）
    )
) else (
    echo [INFO] 创建数据库: %DB_NAME%
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -c "CREATE DATABASE \"%DB_NAME%\";"
)

echo [INFO] 导入数据库结构...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SQL_FILE%"

if errorlevel 1 (
    echo [ERROR] 导入失败
    exit /b 1
)

echo [SUCCESS] 数据库初始化完成！
echo [INFO] 连接信息:
echo   postgresql://%DB_USER%:****@%DB_HOST%:%DB_PORT%/%DB_NAME%

goto next_steps

REM ============================================================
REM Docker 模式
REM ============================================================

:docker_mode
echo [INFO] 检查 Docker...
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] docker 命令未找到，请安装 Docker Desktop
    echo [INFO] 下载地址: https://www.docker.com/products/docker-desktop
    exit /b 1
)

echo [INFO] 检查 Docker 容器...
docker ps -a --format "{{.Names}}" | findstr /x "nest-admin-db" >nul 2>&1
if errorlevel 1 (
    echo [INFO] 创建新的 PostgreSQL 容器...
    docker run -d ^
        --name nest-admin-db ^
        -e POSTGRES_USER=postgres ^
        -e POSTGRES_PASSWORD=postgres ^
        -e POSTGRES_DB=nest-admin ^
        -p 5432:5432 ^
        postgres:16-alpine

    echo [INFO] 等待容器启动...
    timeout /t 10 /nobreak >nul
) else (
    echo [INFO] 容器 nest-admin-db 已存在
    docker ps --format "{{.Names}}" | findstr /x "nest-admin-db" >nul 2>&1
    if errorlevel 1 (
        echo [INFO] 启动容器...
        docker start nest-admin-db
        timeout /t 3 /nobreak >nul
    )
)

REM 检查数据库是否存在
for /f "delims=" %%i in ('docker exec nest-admin-db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'"') do set DB_EXISTS=%%i

if "%DB_EXISTS%"=="1" (
    if "%FORCE_REBUILD%"=="true" (
        echo [WARNING] 删除现有数据库: %DB_NAME%
        docker exec nest-admin-db psql -U postgres -c "DROP DATABASE IF EXISTS \"%DB_NAME%\";"
        docker exec nest-admin-db psql -U postgres -c "CREATE DATABASE \"%DB_NAME%\";"
    ) else (
        echo [WARNING] 数据库 %DB_NAME% 已存在，将直接导入（表已存在时会跳过）
    )
) else (
    echo [INFO] 创建数据库: %DB_NAME%
    docker exec nest-admin-db psql -U postgres -c "CREATE DATABASE \"%DB_NAME%\";"
)

echo [INFO] 导入数据库结构...
docker exec -i nest-admin-db psql -U postgres -d %DB_NAME% < "%SQL_FILE%"

if errorlevel 1 (
    echo [ERROR] 导入失败
    exit /b 1
)

echo [SUCCESS] 数据库初始化完成！
echo [INFO] 连接信息:
echo   postgresql://postgres:postgres@localhost:5432/%DB_NAME%

:next_steps
echo.
echo ================================================
echo 下一步操作
echo ================================================
echo 1. 配置数据库连接（config/development.local.yaml）:
echo.
echo    database:
if "%USE_DOCKER%"=="true" (
    echo      url: postgresql://postgres:postgres@localhost:5432/%DB_NAME%?schema=public
) else (
    echo      url: postgresql://%DB_USER%:PASSWORD@%DB_HOST%:%DB_PORT%/%DB_NAME%?schema=public
)
echo.
echo 2. 创建超级管理员账号:
echo.
echo    npm run bootstrap:superadmin
echo.
echo 3. 启动应用:
echo.
echo    npm run start:dev
echo.
echo [SUCCESS] 初始化完成！
