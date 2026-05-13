"""
download_models.py — Executed during Docker image BUILD to pre-cache HuggingFace models.

Models are saved to /app/models so the runtime never hits the HuggingFace Hub.
This eliminates the ~500MB download that was causing Render's RAM/timeout limits.

Usage (called from Dockerfile RUN step):
    python download_models.py
"""

import os
import sys

# All models land here — this path is baked into the image layer.
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
RERANKER_MODEL  = os.getenv("RERANKER_MODEL",  "cross-encoder/ms-marco-MiniLM-L-6-v2")


def download_embedding():
    print(f"[download] Embedding model → {EMBEDDING_MODEL}")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(EMBEDDING_MODEL, cache_folder=MODELS_DIR)
    # Smoke-test: ensures weights are fully written before the layer is committed
    _ = model.encode("smoke test", show_progress_bar=False)
    print(f"[download] ✓ Embedding model cached at {MODELS_DIR}")


def download_reranker():
    print(f"[download] Reranker model → {RERANKER_MODEL}")
    from sentence_transformers import CrossEncoder
    # CrossEncoder uses HuggingFace cache; point it at our models dir
    os.environ["HF_HOME"]            = MODELS_DIR
    os.environ["TRANSFORMERS_CACHE"] = MODELS_DIR
    model = CrossEncoder(RERANKER_MODEL)
    _ = model.predict([("test query", "test passage")])
    print(f"[download] ✓ Reranker model cached at {MODELS_DIR}")


if __name__ == "__main__":
    try:
        download_embedding()
        download_reranker()
        print("[download] All models pre-cached successfully. Container is build-ready.")
    except Exception as exc:
        print(f"[download] FATAL: {exc}", file=sys.stderr)
        sys.exit(1)
