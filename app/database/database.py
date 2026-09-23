import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings
from app.utils.logger import log_info, log_warning, log_error

os.makedirs('data', exist_ok=True)

Base = declarative_base()

def get_engine():
    db_url = settings.DATABASE_URL
    try:
        if db_url.startswith('sqlite'):
            engine = create_engine(
                db_url,
                connect_args={'check_same_thread': False}
            )
        else:
            engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_recycle=3600
            )
        with engine.connect() as conn:
            pass
        log_info('DATABASE', 'Database connected successfully')
        return engine
    except Exception as e:
        if settings.FALLBACK_TO_SQLITE:
            fallback_url = 'sqlite:///./data/facebook_automation.db'
            log_warning('DATABASE', f'Failed to connect to configured DB ({e}). Falling back to SQLite: {fallback_url}')
            return create_engine(
                fallback_url,
                connect_args={'check_same_thread': False}
            )
        else:
            log_error('DATABASE', f'Fatal database connection error: {e}')
            raise

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import app.database.models
    from sqlalchemy import inspect, text

    # 1. Create any tables that don't exist yet
    Base.metadata.create_all(bind=engine)

    # 2. Automatically add any newly defined columns to existing tables
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        
        with engine.begin() as conn:
            for table_name, table in Base.metadata.tables.items():
                if table_name in existing_tables:
                    existing_cols = {c['name'] for c in inspector.get_columns(table_name)}
                    for col in table.columns:
                        if col.name not in existing_cols:
                            try:
                                col_type = col.type.compile(engine.dialect)
                                log_info('DATABASE', f'Auto-migrating: Adding column {table_name}.{col.name} ({col_type})')
                                conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}'))
                            except Exception as col_err:
                                log_warning('DATABASE', f'Notice: Could not add column {table_name}.{col.name}: {col_err}')
    except Exception as mig_err:
        log_warning('DATABASE', f'Auto-migration check notice: {mig_err}')

    # Backfill default values for newly added columns in existing rows
    try:
        with engine.connect() as conn:
            conn.execute(text('UPDATE email_provider_settings SET telegram_alerts_enabled = 0 WHERE telegram_alerts_enabled IS NULL'))
            conn.execute(text('UPDATE email_provider_settings SET telegram_notify_on_complete = 1 WHERE telegram_notify_on_complete IS NULL'))
            conn.execute(text('UPDATE email_provider_settings SET telegram_notify_on_error = 1 WHERE telegram_notify_on_error IS NULL'))
            conn.execute(text('UPDATE email_campaign_recipients SET open_count = 0 WHERE open_count IS NULL'))
            conn.execute(text('UPDATE email_campaign_recipients SET click_count = 0 WHERE click_count IS NULL'))
            conn.commit()
    except Exception as bf_err:
        log_warning('DATABASE', f'Backfill notice: {bf_err}')

    # 3. Seed default email account if none exists
    try:
        from app.database.models import EmailProviderSetting
        db = SessionLocal()
        try:
            acc_count = db.query(EmailProviderSetting).count()
            if acc_count == 0:
                default_acc = EmailProviderSetting(
                    name="Tài khoản mặc định",
                    is_active=True,
                    priority=1,
                    provider_name="MockEmailProvider",
                    from_email="outreach@aesthetichub.vn",
                    from_name="Aesthetic Conference Intelligence",
                    daily_limit=300
                )
                db.add(default_acc)
                db.commit()
                log_info('DATABASE', 'Created initial default email account.')
        finally:
            db.close()
    except Exception as seed_err:
        log_warning('DATABASE', f'Initial seed notice: {seed_err}')

    log_info('DATABASE', 'Database tables verified and initialized')

