# DeepRead (Agentic RAG)

DeepRead is an agentic Retrieval-Augmented Generation (RAG) system with a FastAPI backend and a React/Vite frontend. It allows users to upload PDF documents, index them using FAISS, and query them with semantic search, cross-encoder reranking, and an integrated web search agent using Google's Gemini LLM.

## Architecture & Containerization
This project is fully containerized for deployment on Google Cloud Run:
- **Backend:** Python 3.11 with FastAPI. Uses a multi-stage Docker build that pre-downloads HuggingFace models (`sentence-transformers`) during image creation to prevent cold-start penalties.
- **Frontend:** React SPA built with Vite. Uses a multi-stage Docker build to compile the app and serves it via an optimized Nginx container.

## Local Development (Docker)
Ensure you have Docker and Docker Compose installed.

1. **Environment Variables:**
   Copy `.env.example` to `.env` (optional for local, as docker-compose handles defaults).
   ```bash
   cp .env.example .env
   ```

2. **Start the Stack:**
   ```bash
   make up
   # or
   docker-compose up -d
   ```
   - Frontend available at `http://localhost:3000`
   - Backend available at `http://localhost:8000`

3. **Stop the Stack:**
   ```bash
   make down
   ```

## Cloud Run Deployment
To deploy to Google Cloud Run, use the included deployment script. Ensure you are authenticated with `gcloud` and have the necessary permissions.

```bash
./deploy.sh
```
This script handles building, pushing, deploying, and properly injecting the backend URL into the frontend build.

## Technology Stack
- **Frontend:** React 18, Vite, Vanilla CSS, Nginx (for production serving).
- **Backend:** FastAPI, LangChain, FAISS, PyPDF, Sentence-Transformers, Google Gemini API (`gemini-2.5-flash`), DuckDuckGo Search.
