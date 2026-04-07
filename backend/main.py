import os
import uuid
import tempfile
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import PromptTemplate

from sentence_transformers import CrossEncoder
from duckduckgo_search import DDGS

import json
import asyncio

app = FastAPI(title="DeepRead API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store
sessions: dict = {}
INDEXES_DIR = Path("indexes")
INDEXES_DIR.mkdir(exist_ok=True)

cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


class ChatRequest(BaseModel):
    session_id: str
    question: str
    api_key: str
    web_search: bool = False


class SummaryRequest(BaseModel):
    session_id: str
    api_key: str


def rerank_docs(query: str, docs: list, top_k: int = 3):
    if not docs:
        return []
    pairs = [(query, doc.page_content) for doc in docs]
    scores = cross_encoder.predict(pairs)
    scored = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
    return [(doc, float(score)) for score, doc in scored[:top_k]]


def web_search(query: str, max_results: int = 4) -> list[dict]:
    try:
        results = list(DDGS().text(query, max_results=max_results))
        return [{"title": r.get("title",""), "body": r.get("body",""), "href": r.get("href","")} for r in results]
    except Exception:
        return []


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files allowed")

    session_id = str(uuid.uuid4())
    index_path = INDEXES_DIR / session_id

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()

        for i, d in enumerate(docs):
            d.metadata["page"] = i + 1

        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
        chunks = splitter.split_documents(docs)

        vs = FAISS.from_documents(chunks, embeddings)
        vs.save_local(str(index_path))

        sessions[session_id] = {
            "filename": file.filename,
            "page_count": len(docs),
            "chunk_count": len(chunks),
            "chat_history": [],
            "index_path": str(index_path),
        }

        # Quick metadata
        full_text = " ".join([d.page_content for d in docs[:5]])
        word_count = sum(len(d.page_content.split()) for d in docs)

        return {
            "session_id": session_id,
            "filename": file.filename,
            "page_count": len(docs),
            "chunk_count": len(chunks),
            "word_count": word_count,
            "preview_text": full_text[:500],
        }
    finally:
        os.unlink(tmp_path)


@app.post("/summarize")
async def summarize(req: SummaryRequest):
    if req.session_id not in sessions:
        raise HTTPException(404, "Session not found")

    session = sessions[req.session_id]
    index_path = session["index_path"]

    vs = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
    sample_docs = vs.similarity_search("main topic summary introduction abstract", k=6)
    context = "\n\n".join([d.page_content for d in sample_docs])

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=req.api_key,
        temperature=0.3,
    )

    prompt = f"""You are an expert document analyst. Analyze this document content and return ONLY a JSON object (no markdown, no backticks) with these exact fields:
{{
  "title": "inferred document title or topic",
  "summary": "2-3 sentence executive summary",
  "key_topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "document_type": "research paper / report / manual / article / book / other",
  "difficulty": "beginner / intermediate / advanced"
}}

Document content:
{context}"""

    response = await llm.ainvoke(prompt)
    try:
        text = response.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
    except Exception:
        data = {
            "title": session["filename"],
            "summary": "Document indexed successfully. Ask me anything about it.",
            "key_topics": [],
            "document_type": "document",
            "difficulty": "intermediate",
        }
    return data


@app.post("/chat")
async def chat(req: ChatRequest):
    if req.session_id not in sessions:
        raise HTTPException(404, "Session not found")

    session = sessions[req.session_id]
    index_path = session["index_path"]

    vs = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)

    # Retrieve more, then rerank
    raw_docs = vs.similarity_search(req.question, k=10)
    reranked = rerank_docs(req.question, raw_docs, top_k=3)
    top_docs = [doc for doc, score in reranked]
    top_scores = [score for doc, score in reranked]

    context = "\n\n---\n\n".join([
        f"[Page {d.metadata.get('page','?')} | Score: {s:.2f}]\n{d.page_content}"
        for d, s in zip(top_docs, top_scores)
    ])

    web_context = ""
    web_results = []
    if req.web_search:
        web_results = web_search(req.question, max_results=3)
        if web_results:
            web_context = "\n\nWEB SEARCH RESULTS:\n" + "\n\n".join([
                f"[{r['title']}]\n{r['body']}" for r in web_results
            ])

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=req.api_key,
        temperature=0.1,
    )

    history_text = ""
    for h in session["chat_history"][-6:]:
        history_text += f"Human: {h['question']}\nAssistant: {h['answer']}\n\n"

    prompt = f"""You are DeepRead, an expert AI document assistant. Answer based on the document context provided.
Be precise, cite page numbers, and be helpful.

CONVERSATION HISTORY:
{history_text}

DOCUMENT CONTEXT (reranked by relevance):
{context}
{web_context}

QUESTION: {req.question}

Provide a clear, well-structured answer. If citing from the document, mention the page number. If web results were provided, clearly distinguish between document and web information."""

    response = await llm.ainvoke(prompt)
    answer = response.content

    sources = []
    for doc, score in zip(top_docs, top_scores):
        sources.append({
            "page": doc.metadata.get("page", "?"),
            "score": round(score * 100),
            "preview": doc.page_content[:120] + "...",
        })

    session["chat_history"].append({
        "question": req.question,
        "answer": answer,
    })

    return {
        "answer": answer,
        "sources": sources,
        "web_results": web_results,
    }


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    if session_id in sessions:
        index_path = sessions[session_id].get("index_path")
        if index_path and Path(index_path).exists():
            shutil.rmtree(index_path)
        del sessions[session_id]
    return {"ok": True}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
