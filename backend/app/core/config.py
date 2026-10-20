from pydantic import field_validator
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

    # Default metric thresholds
    CPU_THRESHOLD_PCT: float = 80.0
    MEM_THRESHOLD_PCT: float = 85.0
    DISK_THRESHOLD_PCT: float = 90.0
    LATENCY_P95_THRESHOLD_SECONDS: float = 0.5  # 500ms
    ERROR_RATE_THRESHOLD_PCT: float = 5.0       # 5%
    # Container restart threshold: default is 1, meaning a breach occurs when container
    # restart count strictly exceeds 1 (> 1 restarts in observation window).
    CONTAINER_RESTART_THRESHOLD: int = 1
    CONTAINER_RESTART_WINDOW_MINUTES: int = 15  # 15 minutes window
    DEMO_DATA_DIR_BYTES_THRESHOLD: float = 104857600.0  # 100 MB in bytes

    @field_validator("DETECTION_CONSECUTIVE_BREACHES", "DETECTION_RECOVERY_CHECKS", "DETECTION_INTERVAL_SECONDS")
    @classmethod
    def validate_positive_int(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Detection check counts and intervals must be at least 1.")
        return v

    # ------------------------------------------------------------------ #
    # AI / Gemini                                                          #
    # ------------------------------------------------------------------ #
    GEMINI_API_KEY: str = "your_gemini_api_key_here"
    GEMINI_MODEL: str = "gemini-3.5-flash"
    LLM_TIMEOUT_SECONDS: int = 60
    ANALYSIS_COOLDOWN_SECONDS: int = 60

    # ------------------------------------------------------------------ #
    # RAG / Retrieval                                                      #
    # ------------------------------------------------------------------ #
    RAG_TOP_K: int = 5
    RAG_MIN_SCORE: float = 0.45

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
