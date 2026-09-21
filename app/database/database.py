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
    Base.metadata.create_all(bind=engine)
    log_info('DATABASE', 'Database tables verified and initialized')
