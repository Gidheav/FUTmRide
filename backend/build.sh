#!/bin/bash
# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements/production.txt

# Run migrations automatically
python manage.py migrate --settings=core.settings.production

# Collect static files
python manage.py collectstatic --noinput --settings=core.settings.production