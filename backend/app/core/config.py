from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # ------------------------------------------------------------------ #
    # Core                                                                 #
    # ------------------------------------------------------------------ #
    PROJECT_NAME: str = "Observability API"
    API_V1_STR: str = "/api/v1"

    # ------------------------------------------------------------------ #
    # Database                                                             #
    # ------------------------------------------------------------------ #
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/observability"

    # ------------------------------------------------------------------ #
    # Auth & Frontend URLs                                                 #
    # ------------------------------------------------------------------ #
    JWT_SECRET: str = "change-me"
    JWT_EXPIRY_MINUTES: int = 1440
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    # Admin seed (used by scripts/seed_admin.py only)
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "CHANGE_ME_BEFORE_SEEDING"

    # ------------------------------------------------------------------ #
    # Email / SMTP                                                         #
    # ------------------------------------------------------------------ #
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@aetherpulse.io"
    SMTP_FROM_NAME: str = "AetherPulse Cloud Observability"
    SMTP_USE_TLS: bool = True

    # ------------------------------------------------------------------ #
    # Prometheus                                                           #
    # ------------------------------------------------------------------ #
    PROMETHEUS_URL: str = "http://prometheus:9090"

    # ------------------------------------------------------------------ #
    # Detection engine                                                     #
    # ------------------------------------------------------------------ #
    DETECTION_INTERVAL_SECONDS: int = 15
    DETECTION_CONSECUTIVE_BREACHES: int = 3
    DETECTION_RECOVERY_CHECKS: int = 3

    # Default metric thresholds (percent)
    CPU_THRESHOLD_PCT: float = 80.0
    MEM_THRESHOLD_PCT: float = 85.0
    DISK_THRESHOLD_PCT: float = 90.0

    # ------------------------------------------------------------------ #
    # AI / Gemini                                                          #
    # ------------------------------------------------------------------ #
    GEMINI_API_KEY: str = "your_gemini_api_key_here"
    GEMINI_MODEL: str = "gemini-1.5-pro"
    LLM_TIMEOUT_SECONDS: int = 30

    # ------------------------------------------------------------------ #
    # Legacy / other services                                              #
    # ------------------------------------------------------------------ #
    LOKI_URL: str = "http://host.docker.internal:3100"
    AGENT_SHARED_SECRET: str = "supersecretagentkey123"
    MODEL_PATH: str = "/models/isolation_forest.pkl"
    ANOMALY_THRESHOLD: float = 0.95
    CORRELATION_WINDOW_MINUTES: int = 15
    QDRANT_URL: str = "http://qdrant:6333"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"


settings = Settings()
