import os
from pathlib import Path

def get_demo_db_url() -> str:
    url = os.getenv("DEMO_DB_URL")
    if url:
        return url
    host = os.getenv("DEMO_DB_HOST", "demo-db")
    port = os.getenv("DEMO_DB_PORT", "5432")
    user = os.getenv("DEMO_DB_USER", "demouser")
    password = os.getenv("DEMO_DB_PASSWORD", "demopassword")
    dbname = os.getenv("DEMO_DB_NAME", "demodb")
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"

DEMO_DB_URL = get_demo_db_url()
FAULT_TOKEN = os.getenv("FAULT_TOKEN", "demo-fault-secret-key")

# Determine default data directory; create directory if permitted
def resolve_demo_data_dir() -> str:
    configured_dir = os.getenv("DEMO_DATA_DIR", "/data/fill")
    try:
        os.makedirs(configured_dir, exist_ok=True)
        return configured_dir
    except (OSError, PermissionError):
        fallback_dir = os.path.join(str(Path(__file__).resolve().parent), "data_fill")
        os.makedirs(fallback_dir, exist_ok=True)
        return fallback_dir

DEMO_DATA_DIR = resolve_demo_data_dir()
