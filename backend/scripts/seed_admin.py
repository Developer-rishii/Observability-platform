import os
import sys

# Add the project root to the python path to allow imports from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.models import User

def seed_admin():
    db = SessionLocal()
    try:
        email = settings.ADMIN_EMAIL
        password = settings.ADMIN_PASSWORD

        if not email or not password or password == "CHANGE_ME_BEFORE_SEEDING":
            print("Error: ADMIN_EMAIL and ADMIN_PASSWORD must be correctly set in the environment.")
            return

        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"Admin user {email} already exists.")
        else:
            hashed_password = get_password_hash(password)
            new_admin = User(
                email=email,
                hashed_password=hashed_password,
                full_name="Platform Admin",
                is_admin=True,
                is_active=True
            )
            db.add(new_admin)
            db.commit()
            print(f"Successfully created admin user: {email}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
