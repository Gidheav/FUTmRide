#!/bin/bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements/production.txt

# ⚠️  ONE-TIME WIPE — remove this line after fresh deploy
rm -f db.sqlite3

# Run migrations automatically
python manage.py migrate --settings=core.settings.production

# Seed admin accounts (idempotent — safe to run on every deploy)
python manage.py seed_admin_accounts --settings=core.settings.production

# Collect static files
python manage.py collectstatic --noinput --settings=core.settings.production