"""
preload_models.py — Run during Docker image build to cache HuggingFace models.

Baking models into the image layer eliminates cold-start download time on
Cloud Run and avoids HuggingFace Hub rate limits in production.

Usage (Dockerfile):
    RUN python preload_models.py
"""

import os
import sys

RERANKER_MODEL = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")


def preload():
    print(f"[preload] Downloading embedding model: {EMBEDDING_MODEL}")
    try:
        from sentence_transformers import SentenceTransformer
        SentenceTransformer(EMBEDDING_MODEL)
        print(f"[preload] ✓ Embedding model ready")
    except Exception as e:
        print(f"[preload] ✗ Embedding model failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[preload] Downloading reranker model: {RERANKER_MODEL}")
    try:
        from sentence_transformers import CrossEncoder
        CrossEncoder(RERANKER_MODEL)
        print(f"[preload] ✓ Reranker model ready")
    except Exception as e:
        print(f"[preload] ✗ Reranker model failed: {e}", file=sys.stderr)
        sys.exit(1)

    print("[preload] All models cached successfully.")


if __name__ == "__main__":
    preload()
