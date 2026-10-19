# RAG Retrieval Notes & Benchmark Results

**Task**: P4 — RAG Ingestion and Search Evaluation  
**Collection**: `incident_knowledge_base` (Qdrant on port 6333)  
**Embedding Model**: `all-MiniLM-L6-v2` (dimension: 384, distance metric: Cosine)  
**Chunking Parameters**: 300–500 tokens (approx. 225–375 words), ~15% overlap, preserving document title and section heading in payload metadata.  
**Total Points Ingested**: 60 chunks from 10 runbooks.

---

## 1. Summary of Results

All 5 fault scenarios defined in `docs/EXECUTION_PLAN.md` (Section 9) were queried against the vector collection using `backend/app/rag/retriever.py:search()`. In 100% of the cases (5/5), the ground-truth runbook was retrieved as the **#1 top result**, with cosine similarity scores comfortably exceeding the 0.40 baseline threshold.

| # | Fault Scenario | Trigger Script | Expected Runbook | Top Hit (#1) | Cosine Score | Pass/Fail |
|---|----------------|----------------|------------------|--------------|--------------|-----------|
| 1 | CPU Stress | `cpu-stress.ps1` | `high-cpu.md` | `high-cpu.md` (Symptoms) | **0.4976** | **PASS** |
| 2 | Container Crash | `container-crash.ps1` | `exit-code-137.md` | `exit-code-137.md` (Likely causes) | **0.7297** | **PASS** |
| 3 | Database Unavailable | `db-stop.ps1` | `postgres-connection-refused.md` | `postgres-connection-refused.md` (Symptoms) | **0.7979** | **PASS** |
| 4 | API Latency | `latency-spike.ps1` | `api-latency.md` | `api-latency.md` (Symptoms) | **0.7530** | **PASS** |
| 5 | Disk Spike | `disk-fill.ps1` | `disk-full.md` | `disk-full.md` (Overview) | **0.6920** | **PASS** |

---

## 2. Detailed Query Evaluations

### Scenario 1: CPU Stress (`cpu-stress.ps1`)
- **Diagnostic Query**: `"high CPU utilization thread exhaustion load average spike core saturation"`
- **Expected Document**: `high-cpu.md`
- **Top 3 Retrieved Chunks**:
  1. **Score: 0.4976** — `high-cpu.md` (`Symptoms`)  
     *Title*: Troubleshooting High CPU Usage in Containerized Services  
     *Content Preview*: CPU usage metric `system_cpu_usage_pct` sustained above 85-90% for consecutive check intervals...
  2. **Score: 0.4444** — `high-cpu.md` (`How to fix`)  
     *Title*: Troubleshooting High CPU Usage in Containerized Services  
     *Content Preview*: Identify high-CPU threads or processes within the container using `top -H -p <pid>`...
  3. **Score: 0.4435** — `high-cpu.md` (`Likely causes`)  
     *Title*: Troubleshooting High CPU Usage in Containerized Services  
     *Content Preview*: Unbounded while-loops, inefficient algorithmic complexity (O(n^2)+) on large payloads...
- **Result**: Ground-truth runbook occupied all top 3 positions. **PASS**.

---

### Scenario 2: Container Crash (`container-crash.ps1`)
- **Diagnostic Query**: `"container die exit code 137 SIGKILL process killed unexpected restart container crash loop"`
- **Expected Document**: `exit-code-137.md` (or `container-crash-loop.md`)
- **Top 3 Retrieved Chunks**:
  1. **Score: 0.7297** — `exit-code-137.md` (`Likely causes`)  
     *Title*: Troubleshooting Docker Container Exit Code 137  
     *Content Preview*: Linux kernel Out-Of-Memory (OOM) Killer terminated the container process due to memory limit breach...
  2. **Score: 0.7125** — `container-crash-loop.md` (`Overview`)  
     *Title*: Diagnosing Container CrashLoopBackOff and Restart Cycles  
     *Content Preview*: Container repeatedly starts, encounters a fatal fault, exits with a non-zero exit code...
  3. **Score: 0.7098** — `exit-code-137.md` (`How to check`)  
     *Title*: Troubleshooting Docker Container Exit Code 137  
     *Content Preview*: Inspect container exit reason via `docker inspect <container> --format '{{.State.OOMKilled}}'`...
- **Result**: Relevant runbooks occupied top 3 positions with high semantic similarity (>0.70). **PASS**.

---

### Scenario 3: Database Unavailable (`db-stop.ps1`)
- **Diagnostic Query**: `"postgres connection refused could not connect to server port 5432 database down"`
- **Expected Document**: `postgres-connection-refused.md`
- **Top 3 Retrieved Chunks**:
  1. **Score: 0.7979** — `postgres-connection-refused.md` (`Symptoms`)  
     *Title*: Resolving PostgreSQL Connection Refused Errors  
     *Content Preview*: Backend error logs repeating `psycopg2.OperationalError: could not connect to server: Connection refused`...
  2. **Score: 0.7906** — `postgres-connection-refused.md` (`Likely causes`)  
     *Title*: Resolving PostgreSQL Connection Refused Errors  
     *Content Preview*: PostgreSQL container (`demo-db` or `db`) stopped, crashed, or restarting...
  3. **Score: 0.7322** — `postgres-connection-refused.md` (`Overview`)  
     *Title*: Resolving PostgreSQL Connection Refused Errors  
     *Content Preview*: Service unable to reach PostgreSQL database instance over the specified host port...
- **Result**: Direct match for PostgreSQL connection failures. Top score **0.7979**. **PASS**.

---

### Scenario 4: API Latency Spike (`latency-spike.ps1`)
- **Diagnostic Query**: `"high API response duration p95 latency spike slow endpoint degradation"`
- **Expected Document**: `api-latency.md`
- **Top 3 Retrieved Chunks**:
  1. **Score: 0.7530** — `api-latency.md` (`Symptoms`)  
     *Title*: Diagnosing and Mitigating High API Latency  
     *Content Preview*: p95 and p99 request duration metrics exceeding acceptable SLAs (>1000ms)...
  2. **Score: 0.6898** — `api-latency.md` (`Overview`)  
     *Title*: Diagnosing and Mitigating High API Latency  
     *Content Preview*: API latency degradation where request response times increase significantly...
  3. **Score: 0.5895** — `api-latency.md` (`Likely causes`)  
     *Title*: Diagnosing and Mitigating High API Latency  
     *Content Preview*: Downstream blocking database queries, network contention, thread saturation...
- **Result**: Direct match for API latency degradation runbook. Top score **0.7530**. **PASS**.

---

### Scenario 5: Disk Spike (`disk-fill.ps1`)
- **Diagnostic Query**: `"disk space full no space left on device filesystem saturation threshold breach"`
- **Expected Document**: `disk-full.md`
- **Top 3 Retrieved Chunks**:
  1. **Score: 0.6920** — `disk-full.md` (`Overview`)  
     *Title*: Troubleshooting Disk Full and Filesystem Saturation  
     *Content Preview*: Disk utilization metric `demo_data_dir_bytes` or root filesystem exceeding 90% threshold...
  2. **Score: 0.6585** — `disk-full.md` (`Symptoms`)  
     *Title*: Troubleshooting Disk Full and Filesystem Saturation  
     *Content Preview*: System logs displaying `No space left on device` (ENOSPC)...
  3. **Score: 0.5616** — `disk-full.md` (`How to check`)  
     *Title*: Troubleshooting Disk Full and Filesystem Saturation  
     *Content Preview*: Check disk space usage via `df -h` and `du -sh /data/*`...
- **Result**: Direct match for disk full runbook. Top score **0.6920**. **PASS**.

---

## 3. Retriever Implementation Details for R4 Consumers

The retriever module is implemented at [`backend/app/rag/retriever.py`](file:///d:/major_project_pooja/Observability-platform/backend/app/rag/retriever.py) and exported directly from [`backend/app/rag/__init__.py`](file:///d:/major_project_pooja/Observability-platform/backend/app/rag/__init__.py).

### Consumer Usage (for Rushikesh / Task R4):

```python
from app.rag import search

# Query knowledge base for relevant runbook sections
hits = search(
    query="postgres connection refused port 5432",
    k=3,            # Return top 3 matches
    min_score=0.45  # Filter out low-confidence hits
)

for hit in hits:
    print(f"[{hit['source_file']}] (Score: {hit['score']}) {hit['title']} / {hit['section']}")
    print(hit['content'])
```

### Return Data Structure:
```python
[
    {
        "id": "uuid-string",
        "score": 0.7979,
        "title": "Resolving PostgreSQL Connection Refused Errors",
        "section": "Symptoms",
        "content": "Document: Resolving PostgreSQL Connection Refused Errors\nSection: Symptoms\nSource: postgres-connection-refused.md\n\n...",
        "source_file": "postgres-connection-refused.md",
        "metadata": {
            "title": "Resolving PostgreSQL Connection Refused Errors",
            "section": "Symptoms",
            "source_file": "postgres-connection-refused.md",
            "chunk_index": 0,
            "word_count": 85
        }
    }
]
```

---

## 4. Ingestion Command

To re-ingest or update runbooks in Qdrant at any time:

```bash
docker compose run --rm -v "${PWD}/rag:/rag:ro" backend python -m app.rag.ingest
```

This recreates the `incident_knowledge_base` collection and populates 384-dimensional cosine similarity embeddings from all markdown documents in `rag/knowledge_base/`.
