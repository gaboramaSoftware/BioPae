from sqlalchemy.orm import Session
from core.Domain.Repository.UserRepository import SessionLocal


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
