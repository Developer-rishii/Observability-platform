FROM python:3.11-slim

WORKDIR /app

# Create dedicated demo data directory for disk faults
RUN mkdir -p /data/fill

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
