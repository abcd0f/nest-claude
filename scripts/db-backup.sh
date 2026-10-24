#!/bin/bash

###############################################################################
# Database Backup Script
#
# This script creates a backup of the PostgreSQL database
#
# Usage:
#   ./scripts/db-backup.sh [backup-name]
#
# Environment variables (from .env or manually set):
#   DATABASE_URL - PostgreSQL connection string
#
# Example:
#   ./scripts/db-backup.sh pre-migration
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

# Backup directory
BACKUP_DIR="$PROJECT_ROOT/backups"
mkdir -p "$BACKUP_DIR"

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
# Format: postgresql://user:password@host:port/database
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

# Backup name
BACKUP_NAME="${1:-backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

echo -e "${GREEN}=== Database Backup ===${NC}"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE_GZ"
echo ""

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
export PGPASSWORD="$DB_PASSWORD"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  --file="$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Backup created${NC}"

  # Compress backup
  echo -e "${YELLOW}Compressing backup...${NC}"
  gzip "$BACKUP_FILE"

  if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    echo -e "${GREEN}✓ Backup compressed (size: $BACKUP_SIZE)${NC}"
    echo -e "${GREEN}✓ Backup saved to: $BACKUP_FILE_GZ${NC}"

    # List recent backups
    echo ""
    echo -e "${YELLOW}Recent backups:${NC}"
    ls -lh "$BACKUP_DIR" | tail -5

    # Cleanup old backups (keep last 10)
    echo ""
    echo -e "${YELLOW}Cleaning up old backups (keeping last 10)...${NC}"
    cd "$BACKUP_DIR"
    ls -t *.sql.gz | tail -n +11 | xargs -r rm --
    echo -e "${GREEN}✓ Cleanup complete${NC}"
  else
    echo -e "${RED}✗ Failed to compress backup${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Backup failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== Backup Complete ===${NC}"
