from logging.config import fileConfig
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
fileConfig(config.config_file_name)

# add repo root to path so `services...` imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from services.backend.app.config import settings
from services.backend.app.db import Base
from services.backend.app import models

target_metadata = Base.metadata


def get_url() -> str:
    return os.getenv("DATABASE_URL") or settings.DATABASE_URL


def run_migrations_offline():
    context.configure(url=get_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = create_engine(get_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
