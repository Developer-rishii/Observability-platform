from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
import logging
from config import DEMO_DB_URL
from models import Base, Product

logger = logging.getLogger("demo_app")

# Ensure PostgreSQL dialect uses psycopg2 if needed
db_url = DEMO_DB_URL
if db_url.startswith("postgresql://") and not db_url.startswith("postgresql+psycopg2://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={"connect_timeout": 3} if "sqlite" not in db_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db_health() -> bool:
    """Verify database connection with a fast ping query."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

SEEDED_PRODUCTS = [
    {"name": "Compute Instance General Purpose (2 vCPU, 4GB RAM)", "description": "Balanced virtual machine for web tiers", "price": 24.99, "available_quantity": 100},
    {"name": "Compute Instance High Memory (4 vCPU, 32GB RAM)", "description": "Memory-optimized VM for databases and caches", "price": 89.99, "available_quantity": 50},
    {"name": "Compute Instance CPU Optimized (8 vCPU, 16GB RAM)", "description": "High-clock compute for analytics workloads", "price": 119.99, "available_quantity": 40},
    {"name": "Compute Instance GPU Accelerated (4 vCPU, 1x T4)", "description": "GPU acceleration for ML inference workloads", "price": 249.99, "available_quantity": 25},
    {"name": "Bare Metal Server Tier-1 (32 Cores, 128GB RAM)", "description": "Single-tenant dedicated physical server", "price": 599.99, "available_quantity": 10},
    {"name": "Block Storage Standard SSD (100GB)", "description": "General purpose SSD storage volume", "price": 10.00, "available_quantity": 250},
    {"name": "Block Storage Ultra SSD (500GB, 10k IOPS)", "description": "High-IOPS persistent storage volume", "price": 65.00, "available_quantity": 150},
    {"name": "Block Storage Extreme NVMe (1TB, 30k IOPS)", "description": "Ultra low-latency NVMe block volume", "price": 140.00, "available_quantity": 80},
    {"name": "Object Storage Standard (1TB Multi-Region)", "description": "Scalable durable object storage", "price": 22.00, "available_quantity": 500},
    {"name": "Object Storage Cold Archive (5TB Glacier Tier)", "description": "Long-term cold archive for compliance backups", "price": 25.00, "available_quantity": 300},
    {"name": "Managed PostgreSQL HA Cluster (v15)", "description": "Multi-AZ managed PostgreSQL with automatic failover", "price": 180.00, "available_quantity": 30},
    {"name": "Managed MySQL Cluster (v8.0, 3 Nodes)", "description": "Replicated managed MySQL instance", "price": 160.00, "available_quantity": 35},
    {"name": "Managed Redis In-Memory Cache (Cluster 6GB)", "description": "Sub-millisecond latency managed Redis cluster", "price": 55.00, "available_quantity": 120},
    {"name": "Managed Kafka Streaming Broker (3 Partitions)", "description": "Event streaming message queue cluster", "price": 210.00, "available_quantity": 20},
    {"name": "Managed RabbitMQ Cluster (High Availability)", "description": "AMQP message broker for task distribution", "price": 95.00, "available_quantity": 45},
    {"name": "Managed OpenSearch Cluster (3 Data Nodes)", "description": "Full-text log search and analytics engine", "price": 230.00, "available_quantity": 15},
    {"name": "Application Load Balancer (Layer 7, Multi-AZ)", "description": "HTTP/HTTPS path-based traffic router", "price": 35.00, "available_quantity": 200},
    {"name": "Network Load Balancer (Layer 4, Ultra-Low Latency)", "description": "High-throughput TCP/UDP load balancer", "price": 40.00, "available_quantity": 180},
    {"name": "Global Anycast Content Delivery Network (5TB)", "description": "Edge caching network with DDoS mitigation", "price": 45.00, "available_quantity": 300},
    {"name": "Cloud NAT Gateway (Dedicated IP)", "description": "Outbound egress gateway for private subnets", "price": 32.00, "available_quantity": 110},
    {"name": "VPC Peering Connection (Inter-Region)", "description": "Encrypted private cloud interconnect", "price": 15.00, "available_quantity": 250},
    {"name": "Direct Connect Dedicated Fiber (1 Gbps Port)", "description": "Dedicated hybrid cloud fiber interconnect", "price": 450.00, "available_quantity": 12},
    {"name": "Web Application Firewall (WAF Enterprise Shield)", "description": "OWASP Top 10 rule matching & bot mitigation", "price": 75.00, "available_quantity": 150},
    {"name": "DDoS Protection Advanced Service", "description": "Always-on volumetric attack protection", "price": 300.00, "available_quantity": 40},
    {"name": "Managed Kubernetes Control Plane (EKS/GKE)", "description": "Highly available container orchestration master", "price": 72.00, "available_quantity": 60},
    {"name": "Serverless Container Execution (1M Invocations)", "description": "On-demand container billing pool", "price": 20.00, "available_quantity": 400},
    {"name": "Serverless Function Runtime (100k GB-sec)", "description": "Event-driven compute execution units", "price": 18.00, "available_quantity": 500},
    {"name": "API Gateway Standard (5M Requests/mo)", "description": "Throttling, authentication, and routing proxy", "price": 25.00, "available_quantity": 350},
    {"name": "Container Registry Private (100GB Storage)", "description": "Vulnerability scanning container artifact store", "price": 15.00, "available_quantity": 200},
    {"name": "Continuous Deployment Pipeline Runner (1000 Mins)", "description": "Automated build and test ephemeral executors", "price": 30.00, "available_quantity": 180},
    {"name": "Automated Snapshot Backup Policy (Daily 30-Day)", "description": "Consistent block-level snapshot automation", "price": 28.00, "available_quantity": 220},
    {"name": "Disaster Recovery Replication Stream", "description": "Cross-region asynchronous replication stream", "price": 160.00, "available_quantity": 25},
    {"name": "Secrets Management Vault (Up to 1000 Keys)", "description": "Hardware security module backed key vault", "price": 40.00, "available_quantity": 140},
    {"name": "Public Certificate Authority Wildcard SSL", "description": "Automated renewal multi-domain TLS cert", "price": 50.00, "available_quantity": 300},
    {"name": "Managed DNS Private Zone (10k Records)", "description": "Low-latency authoritative internal DNS zone", "price": 8.00, "available_quantity": 450},
    {"name": "Elastic IP Address Allocation (Static IPv4)", "description": "Reserved public IPv4 internet gateway address", "price": 5.00, "available_quantity": 500},
    {"name": "IPv6 Transit Gateway Endpoint", "description": "Dual-stack routing mesh interconnect", "price": 20.00, "available_quantity": 190},
    {"name": "Network File System (NFS) Share (2TB)", "description": "Elastic distributed POSIX shared storage", "price": 120.00, "available_quantity": 70},
    {"name": "Distributed Key-Value Store (Dynamo-compatible)", "description": "Single-digit millisecond NoSQL table tier", "price": 65.00, "available_quantity": 130},
    {"name": "Time-Series Telemetry Database Node", "description": "High-write throughput metric storage engine", "price": 145.00, "available_quantity": 35},
    {"name": "Log Ingestion Pipeline Throughput (10GB/day)", "description": "Streaming ingestion with structured indexing", "price": 35.00, "available_quantity": 210},
    {"name": "Security Information & Event Manager (SIEM Agent)", "description": "Real-time log correlation and threat detection", "price": 110.00, "available_quantity": 60},
    {"name": "Identity & Access Management Directory Sync", "description": "Active Directory / LDAP cloud connector", "price": 45.00, "available_quantity": 90},
    {"name": "Single Sign-On (SAML/OIDC Connector)", "description": "Enterprise federated identity gateway", "price": 55.00, "available_quantity": 100},
    {"name": "Compliance Audit Trail Archive (1-Year Retention)", "description": "WORM (Write Once Read Many) immutable logs", "price": 85.00, "available_quantity": 80},
    {"name": "VPN Client Access Gateway (25 Concurrent Tunnels)", "description": "Secure remote employee mesh tunnel", "price": 60.00, "available_quantity": 95},
    {"name": "Site-to-Site IPsec VPN Gateway", "description": "High-throughput redundant tunnel to on-premise datacenter", "price": 90.00, "available_quantity": 50},
    {"name": "Edge Compute Worker Node (5ms Latency Tier)", "description": "CDN edge server execution container", "price": 40.00, "available_quantity": 150},
    {"name": "AI Inference Accelerator Endpoint (FP16)", "description": "Dedicated Tensor Core inference server", "price": 220.00, "available_quantity": 30},
    {"name": "Cloud Telemetry Synthetic Monitoring Probes", "description": "Global uptime and API health checking agents", "price": 30.00, "available_quantity": 200}
]

def init_db_and_seed() -> None:
    """Create tables if they don't exist and seed 50 demo products if table is empty."""
    try:
        Base.metadata.create_all(bind=engine)
        with get_db_context() as db:
            existing_count = db.query(Product).count()
            if existing_count == 0:
                logger.info("Database empty: seeding 50 demo products...")
                for item in SEEDED_PRODUCTS:
                    product = Product(
                        name=item["name"],
                        description=item["description"],
                        price=item["price"],
                        available_quantity=item["available_quantity"]
                    )
                    db.add(product)
                db.commit()
                logger.info("Successfully seeded 50 demo products.")
            else:
                logger.info(f"Database already contains {existing_count} products. Skipping seeding.")
    except Exception as e:
        logger.error(f"Error during database initialization/seeding: {e}")
        # Let startup continue; endpoints will surface DB unavailability if down
