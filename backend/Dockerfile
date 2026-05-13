# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Build tools needed for FAISS and native C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy compiled packages from builder
COPY --from=builder /install /usr/local

# Copy application source + model download script
COPY main.py download_models.py ./

# ── Pre-download models into /app/models at BUILD time ────────────────────────
# This bakes ~500 MB of weights into the image layer so the container never
# hits the HuggingFace Hub at runtime — fixing Render's RAM/timeout failures.
ARG EMBEDDING_MODEL=all-MiniLM-L6-v2
ARG RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
ENV EMBEDDING_MODEL=${EMBEDDING_MODEL}
ENV RERANKER_MODEL=${RERANKER_MODEL}

# Tell HuggingFace libraries to use our deterministic local path
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models

RUN python download_models.py

# Ensure FAISS index directory exists
RUN mkdir -p /app/indexes

# ── Runtime config ─────────────────────────────────────────────────────────────
# Render injects PORT at runtime; default to 10000 (Render's standard)
ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
