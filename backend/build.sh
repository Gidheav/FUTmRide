#!/bin/bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements/base.txt
pip install -r requirements/production.txt

# Run migrations automatically
python manage.py makemigrations --merge --noinput
python manage.py migrate --settings=core.settings.production

# Seed/repair admin accounts only when explicitly enabled.
if [ "${SEED_ADMIN_ACCOUNTS}" = "true" ] || [ "${RESET_SEEDED_ADMIN_PASSWORDS}" = "true" ]; then
	python manage.py seed_admin_accounts --settings=core.settings.production
fi

# Collect static files
python manage.py collectstatic --noinput --settings=core.settings.production
