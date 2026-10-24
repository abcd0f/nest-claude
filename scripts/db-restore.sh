#!/bin/bash

###############################################################################
# Database Restore Script
#
# This script restores a PostgreSQL database from a backup file
#
# Usage:
#   ./scripts/db-restore.sh <backup-file>
#
# Environment variables (from .env or manually set):
#   DATABASE_URL - PostgreSQL connection string
#
# Example:
#   ./scripts/db-restore.sh backups/pre-migration_20250124_120000.sql.gz
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if backup file is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Backup file not provided${NC}"
  echo ""
  echo "Usage: $0 <backup-file>"
  echo ""
  echo "Available backups:"
  ls -lh "$PROJECT_ROOT/backups" 2>/dev/null | tail -10 || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo -e "${GREEN}Loading environment from .env${NC}"
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL is not set${NC}"
  echo "Please set DATABASE_URL environment variable or create .env file"
  exit 1
fi

# Parse DATABASE_URL
REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)"
if [[ $DATABASE_URL =~ $REGEX ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASSWORD="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  echo -e "${RED}Error: Invalid DATABASE_URL format${NC}"
  echo "Expected format: postgresql://user:password@host:port/database"
  exit 1
fi

echo -e "${YELLOW}=== Database Restore ===${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE"
echo ""

# Confirm restore
echo -e "${RED}⚠️  WARNING: This will replace all data in the database!${NC}"
read -p "Are you sure you want to restore? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo -e "${YELLOW}Restore cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${YELLOW}Creating backup of current database before restore...${NC}"
"$SCRIPT_DIR/db-backup.sh" "before-restore"

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Failed to create backup${NC}"
  exit 1
fi

# Decompress if needed
TEMP_FILE=""
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo ""
  echo -e "${YELLOW}Decompressing backup...${NC}"
  TEMP_FILE=$(mktemp)
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  SQL_FILE="$TEMP_FILE"
else
  SQL_FILE="$BACKUP_FILE"
fi

# Restore database
echo ""
echo -e "${YELLOW}Restoring database...${NC}"
export PGPASSWORD="$DB_PASSWORD"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --quiet \
  --file="$SQL_FILE"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Database restored successfully${NC}"

  # Cleanup temp file
  if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi

  echo ""
  echo -e "${GREEN}=== Restore Complete ===${NC}"
else
  echo -e "${RED}✗ Restore failed${NC}"

  # Cleanup temp file
  if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi

  exit 1
fi
