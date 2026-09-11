# 5. Page Breakdown — Admin Area

> Admin pages require authentication with Admin privileges.

---

## 5.1 System Configurations & Thresholds
Manage system monitoring thresholds and anomaly thresholds.

**Components / Features:**
- Anomaly threshold slider (`ANOMALY_THRESHOLD` e.g. 0.95).
- Correlation window setting (`CORRELATION_WINDOW_MINUTES` e.g. 15 mins).
- JWT secret expiry & key rotation settings.

---

## 5.2 Knowledge Base & RAG Vector Management
Manage documentation and runbooks indexed into Qdrant vector database.

**Components / Features:**
- Knowledge Document upload/paste form (Markdown / Text runbooks).
- Automatic embedding generation using `all-MiniLM-L6-v2`.
- Vector collection status & index size inspector.

---

## 5.3 User & Access Management
Control platform user accounts and access credentials.

**Components / Features:**
- User table with role management (`admin` vs `user`).
- Active session inspector & agent token generator.
