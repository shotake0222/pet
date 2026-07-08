#!/usr/bin/env bash
set -euo pipefail

echo "Running DB migrations..."
psql "$DATABASE_URL" -f db/migrations/001_create_rarities.sql
psql "$DATABASE_URL" -f db/migrations/002_create_attributes.sql
psql "$DATABASE_URL" -f db/migrations/003_create_pet_master_attributes.sql

echo "Migrations applied." 
