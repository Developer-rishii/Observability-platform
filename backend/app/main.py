from fastapi import FastAPI
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1 import (
    auth,
    servers,
    events,
    metrics,
    logs,
    incidents,
    alerts,
    ai,
    rag,
)

setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

import os
from fastapi.middleware.cors import CORSMiddleware

@app.get("/")
def root():
    return {"message": "Observability API is running"}

@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {"status": "healthy"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(servers.router, prefix=f"{settings.API_V1_STR}/servers", tags=["servers"])
app.include_router(events.router, prefix=f"{settings.API_V1_STR}/events", tags=["events"])
app.include_router(metrics.router, prefix=f"{settings.API_V1_STR}/metrics", tags=["metrics"])
app.include_router(logs.router, prefix=f"{settings.API_V1_STR}/logs", tags=["logs"])
app.include_router(incidents.router, prefix=f"{settings.API_V1_STR}/incidents", tags=["incidents"])
app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["alerts"])
app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["ai"])
app.include_router(rag.router, prefix=f"{settings.API_V1_STR}/rag", tags=["rag"])
