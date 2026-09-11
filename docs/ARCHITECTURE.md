# System Architecture Overview

## High-Level Architecture
```
[Frontend (Next.js)] <---> [FastAPI Modular Monolith] <---> [PostgreSQL]
                                    |
                                    +---> [Qdrant Vector DB]
                                    +---> [Prometheus & Loki]
                                    +---> [Gemini AI API]
```

## Core Modules
1. **Ingestion Service**: Processes container metrics and Docker Engine event streams.
2. **Correlation Engine**: Groups events and log anomalies into incidents.
3. **ML Anomaly Detection**: Uses Isolation Forest and rolling z-scores.
4. **RAG Knowledge Retrieval**: Uses Qdrant and `all-MiniLM-L6-v2` embeddings for runbooks.
5. **AI Remediation Service**: Interacts with Google Gemini API for automated root cause analysis.
