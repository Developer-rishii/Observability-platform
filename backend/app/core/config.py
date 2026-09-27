from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "Observability API"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/observability"
    JWT_SECRET: str = "change-me"
    JWT_EXPIRY_MINUTES: int = 1440
    
    PROMETHEUS_URL: str = "http://prometheus:9090"
    LOKI_URL: str = "http://loki:3100"
    AGENT_SHARED_SECRET: str = "supersecretagentkey123"
    MODEL_PATH: str = "/models/isolation_forest.pkl"
    ANOMALY_THRESHOLD: float = 0.95
    CORRELATION_WINDOW_MINUTES: int = 15
    GEMINI_API_KEY: str = "your_gemini_api_key_here"
    QDRANT_URL: str = "http://qdrant:6333"
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    FRONTEND_ORIGIN: str = "http://localhost:3000"

settings = Settings()
