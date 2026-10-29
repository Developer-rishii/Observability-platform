# AetherPulse: 5-Minute Presentation Pitch

> **Target Delivery Time:** 4 minutes 45 seconds (~680 words).  
> **Speaker:** ML-Track Developer / Presenter.  
> **Tone:** Confident, precise, transparent, engineering-focused.  
> **Accompanying Visuals:** AetherPulse Web Dashboard (`http://localhost:5173/`).

---

## [0:00 - 0:45] The Problem & The Vision

*"Good afternoon, judges and evaluators.*

*Modern distributed microservices generate thousands of metrics, logs, and events every minute. When a critical database connection stalls or memory leaks, traditional operations teams face two crippling bottlenecks:*

1. *First, **static threshold alerts fail**—if you set a static CPU alert at 80%, a stealthy memory leak or subtle latency variance slips through undetected until users complain.*
2. *Second, **alert fatigue**—an engineer gets woken up at 3 AM with 50 disparate metric alarms, but zero contextual explanation of the actual root cause.*

*To solve this, we built **AetherPulse**—an end-to-end, hybrid observability platform that combines unsupervised machine learning for anomaly detection with deterministic rule guards and retrieval-augmented generative AI for instant, actionable root cause analysis."*

---

## [0:45 - 1:45] Architectural Blueprint & Telemetry Pipeline

*"Let's look at how telemetry travels through the platform.*

*We run a multi-container microservice environment orchestrated via Docker Compose. Our target service is an e-commerce backend called `demo-app`, subjected to continuous, realistic traffic from an autonomous Locust traffic generator.*

*Every five seconds, **Prometheus** scrapes container-level CPU and memory from **cAdvisor**, host telemetry from **Node Exporter**, and HTTP metrics from our application. Simultaneously, **Grafana Alloy** ships stdout/stderr logs into **Loki**, while an asynchronous daemon streams Docker lifecycle events into **PostgreSQL**.*

*Every fifteen seconds, our **FastAPI Detection Engine** executes our unified feature extraction pipeline, translating millions of raw data points into an 8-dimensional telemetry snapshot."*

---

## [1:45 - 2:45] The ML Engine: Why Isolation Forest & The Hybrid Design

*"As the ML lead on this project, my core responsibility was framing anomaly detection.*

*Why did we choose **Isolation Forest** instead of heavy deep learning models like LSTMs or Autoencoders?*
*In production observability, anomalies are unlabelled, rare, and high-dimensional. Isolation Forest operates on a simple, elegant geometric principle: anomalies are points that require very few random binary splits to isolate in feature space. It scales in $O(n \log n)$ time, trains in milliseconds, and avoids the heavy GPU footprints and catastrophic forgetting of neural networks.*

*We calibrated our model on baseline telemetry, setting our decision threshold at **0.7287**—calculated rigorously as the 99.5th percentile of clean validation scores plus a 0.02 safety margin to enforce a near-zero false alarm rate.*

*Crucially, we avoided the classic trap of blind ML dogmatism. In clean baseline data, critical metrics like HTTP 5xx error rate and disk growth variance are literally zero. An unsupervised algorithm cannot learn from events it has never seen. Therefore, we engineered a **hybrid defense**: Isolation Forest detects subtle multi-metric drift, while deterministic **Rule Guards** immediately flag hard failures—like error rates exceeding 5%, rapid disk growth, or container crash events.*

*To prevent alert fatigue, our scheduler enforces a temporal filter: an anomaly must persist for **3 consecutive cycles (45 seconds)** before an incident is created, backed by a 5-minute duplicate suppression cooldown."*

---

## [2:45 - 3:45] AI-Powered RCA & Interactive Chat

*"Detecting an anomaly is only half the battle. Resolving it fast is what protects uptime.*

*When an incident triggers—for example, Incident #356 caused by a simulated latency spike—our system automatically extracts top-contributing telemetry features using normalized Z-scores. Here, P95 latency variance spiked over 88 standard deviations above normal.*

*We feed these anomalous features into **Qdrant**, our vector database, which performs semantic similarity search across our pre-embedded knowledge base of 60 operational runbooks. We retrieve the 3 most relevant remediation procedures and prompt **Google Gemini**.*

*Within 3 seconds, Gemini synthesizes telemetry, logs, and runbooks into a structured JSON payload detailing the root cause, business impact, and step-by-step remediation commands.*

*Furthermore, on-call engineers can click into **Ask AI**—a streaming contextual chat assistant powered by Groq and Qwen. It injects active incident metrics, container events, and logs directly into the prompt context, while actively stripping sensitive authorization tokens and enforcing prompt-injection defenses."*

---

## [3:45 - 4:45] Honest Engineering & What We Learned

*"Finally, I want to highlight our rigorous testing and honest findings.*

*Through offline and live fault injection—including CPU stress, latency jitter, disk saturation, and container crashes—we demonstrated a 100% detection rate on latency and container faults.*

*However, true engineering demands honesty about limitations:*
1. *In our initial baseline training, a background container restart occurred, giving our baseline dataset minor contamination. This elevated our model's tolerance to moderate CPU spikes, which we caught during validation. We solved this by pairing ML with deterministic guards.*
2. *Second, Prometheus calculates rates over a rolling 5-minute window. Even though our scheduler checks every 15 seconds, auto-resolution takes 5 to 8 minutes because the physical sliding window must clear after a fault stops.*

*With 126 unit tests passing, zero-drift feature extraction, sub-minute anomaly detection, and RAG-grounded remediation, AetherPulse bridges the gap between raw metrics and actionable incident response.*

*Thank you, and I look forward to your questions."*

