import os
import sys

# Add the project root to the python path to allow imports from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.models import User

def seed_admin(email: str = None, password: str = None, update_if_exists: bool = False):
    db = SessionLocal()
    try:
        admin_email = email or os.getenv("ADMIN_EMAIL") or settings.ADMIN_EMAIL
        admin_password = password or os.getenv("ADMIN_PASSWORD") or settings.ADMIN_PASSWORD

        if not admin_email or not admin_password or admin_password == "CHANGE_ME_BEFORE_SEEDING":
            print(
                "Usage: python scripts/seed_admin.py [email] [password] [--update]\n"
                "Or set ADMIN_EMAIL and ADMIN_PASSWORD in environment (not 'CHANGE_ME_BEFORE_SEEDING')."
            )
            return False

        user = db.query(User).filter(User.email == admin_email).first()
        if user:
            if update_if_exists:
                user.hashed_password = get_password_hash(admin_password)
                user.is_admin = True
                user.is_active = True
                db.commit()
                print(f"Updated password and permissions for existing admin user: {admin_email}")
            else:
                print(f"Admin user {admin_email} already exists (pass --update to reset password).")
            return True
        else:
            hashed_password = get_password_hash(admin_password)
            new_admin = User(
                email=admin_email,
                hashed_password=hashed_password,
                full_name="Platform Admin",
                is_admin=True,
                is_active=True,
            )
            db.add(new_admin)
            db.commit()
            print(f"Successfully created admin user: {admin_email}")
            return True
    finally:
        db.close()

if __name__ == "__main__":
    args = sys.argv[1:]
    do_update = "--update" in args
    clean_args = [a for a in args if a != "--update"]
    arg_email = clean_args[0] if len(clean_args) > 0 else None
    arg_pass = clean_args[1] if len(clean_args) > 1 else None
    success = seed_admin(arg_email, arg_pass, update_if_exists=do_update)
    if not success and (not arg_email or not arg_pass):
        sys.exit(1)
