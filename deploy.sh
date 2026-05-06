#!/usr/bin/env bash
# deploy.sh — Build, push, and deploy DeepRead to Google Cloud Run
#
# Prerequisites:
#   gcloud auth login && gcloud auth configure-docker
#   gcloud config set project YOUR_PROJECT_ID
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${GCP_REGION:-us-central1}"
REGISTRY="gcr.io/${PROJECT_ID}"

BACKEND_SERVICE="deepread-backend"
FRONTEND_SERVICE="deepread-frontend"
BACKEND_IMAGE="${REGISTRY}/${BACKEND_SERVICE}"
FRONTEND_IMAGE="${REGISTRY}/${FRONTEND_SERVICE}"

echo "▶ Project : ${PROJECT_ID}"
echo "▶ Region  : ${REGION}"
echo "▶ Registry: ${REGISTRY}"
echo ""

# ── Step 1: Build & push backend ──────────────────────────────────────────────
echo "── [1/4] Building backend image..."
docker build -t "${BACKEND_IMAGE}:latest" ./backend
docker push "${BACKEND_IMAGE}:latest"

# ── Step 2: Deploy backend to Cloud Run ───────────────────────────────────────
echo "── [2/4] Deploying backend to Cloud Run..."
gcloud run deploy "${BACKEND_SERVICE}" \
  --image "${BACKEND_IMAGE}:latest" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 300 \
  --set-env-vars "ALLOWED_ORIGINS=PLACEHOLDER" \
  --quiet

BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" \
  --platform managed --region "${REGION}" \
  --format "value(status.url)")
echo "✓ Backend deployed: ${BACKEND_URL}"

# ── Step 3: Build & push frontend (with backend URL) ──────────────────────────
echo "── [3/4] Building frontend image with VITE_API_URL=${BACKEND_URL}..."
docker build \
  --build-arg "VITE_API_URL=${BACKEND_URL}" \
  -t "${FRONTEND_IMAGE}:latest" \
  ./frontend
docker push "${FRONTEND_IMAGE}:latest"

# ── Step 4: Deploy frontend to Cloud Run ──────────────────────────────────────
echo "── [4/4] Deploying frontend to Cloud Run..."
gcloud run deploy "${FRONTEND_SERVICE}" \
  --image "${FRONTEND_IMAGE}:latest" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --quiet

FRONTEND_URL=$(gcloud run services describe "${FRONTEND_SERVICE}" \
  --platform managed --region "${REGION}" \
  --format "value(status.url)")
echo "✓ Frontend deployed: ${FRONTEND_URL}"

# ── Step 5: Update backend CORS to allow the frontend origin ─────────────────
echo "── [5/5] Updating backend CORS to allow ${FRONTEND_URL}..."
gcloud run services update "${BACKEND_SERVICE}" \
  --platform managed \
  --region "${REGION}" \
  --set-env-vars "ALLOWED_ORIGINS=${FRONTEND_URL}" \
  --quiet

echo ""
echo "════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo "   Frontend : ${FRONTEND_URL}"
echo "   Backend  : ${BACKEND_URL}"
echo "════════════════════════════════════════════════"
