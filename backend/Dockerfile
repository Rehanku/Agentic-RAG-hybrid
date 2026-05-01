# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools needed for FAISS and native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy only the installed packages from the builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY main.py preload_models.py ./

# Pre-download HuggingFace models into the image layer
# (eliminates ~160 MB download on every cold start)
ARG EMBEDDING_MODEL=all-MiniLM-L6-v2
ARG RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
ENV EMBEDDING_MODEL=${EMBEDDING_MODEL}
ENV RERANKER_MODEL=${RERANKER_MODEL}

RUN python preload_models.py

# Ensure indexes directory exists inside the container
RUN mkdir -p /app/indexes

# Cloud Run injects PORT at runtime; default to 8080
ENV PORT=8080
EXPOSE 8080

# Use exec form to receive signals correctly
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
