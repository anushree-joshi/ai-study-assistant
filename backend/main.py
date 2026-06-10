from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pinecone import Pinecone
from groq import Groq
import pypdf
import io
import os
import uuid
import json

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@app.get("/")
def root():
    return {"message": "AI Study Assistant API is running!"}

@app.get("/health")
def health():
    return {"status": "healthy"}

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50):
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

def get_embedding(text: str):
    embedding = pc.inference.embed(
        model="llama-text-embed-v2",
        inputs=[text],
        parameters={"input_type": "passage"}
    )
    return embedding[0].values

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), notebook_id: str = "default"):
    contents = await file.read()

    pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() + " "

    chunks = chunk_text(text)

    vectors = []
    for i, chunk in enumerate(chunks):
        embedding = get_embedding(chunk)
        vectors.append({
            "id": f"{notebook_id}-{file.filename}-chunk-{i}-{uuid.uuid4()}",
            "values": embedding,
            "metadata": {
                "text": chunk,
                "filename": file.filename,
                "chunk_index": i,
                "notebook_id": notebook_id
            }
        })

    batch_size = 50
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch)

    return {
        "filename": file.filename,
        "total_pages": len(pdf_reader.pages),
        "total_chunks": len(chunks),
        "message": "Successfully embedded and stored in Pinecone!"
    }

@app.post("/chat")
async def chat(payload: dict):
    question = payload.get("question")
    notebook_id = payload.get("notebook_id", "default")

    question_embedding = pc.inference.embed(
        model="llama-text-embed-v2",
        inputs=[question],
        parameters={"input_type": "query"}
    )

    results = index.query(
        vector=question_embedding[0].values,
        top_k=5,
        include_metadata=True,
        filter={"notebook_id": {"$eq": notebook_id}}
    )

    context = "\n\n".join([match.metadata["text"] for match in results.matches])

    prompt = (
        "You are a helpful study assistant. Answer the question based on the study material provided below.\n"
        "If the answer isn't in the material, say so clearly.\n\n"
        f"Study Material:\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer:"
    )

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )

    return {
        "answer": response.choices[0].message.content,
        "sources_used": len(results.matches)
    }

@app.post("/summarize")
async def summarize(payload: dict):
    notebook_id = payload.get("notebook_id", "default")

    results = index.query(
        vector=[0.0] * 1024,
        top_k=20,
        include_metadata=True,
        filter={"notebook_id": {"$eq": notebook_id}}
    )

    if not results.matches:
        return {"summary": "No content found for this notebook."}

    context = "\n\n".join([match.metadata["text"] for match in results.matches])

    prompt = (
        "You are a helpful study assistant. Create a clear, concise summary of the following study material.\n"
        "Structure it with:\n"
        "- A 2-3 sentence overview\n"
        "- 5 key points as bullet points\n"
        "- Any important terms or concepts\n\n"
        f"Study Material:\n{context}\n\n"
        "Summary:"
    )

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )

    return {"summary": response.choices[0].message.content}

@app.post("/quiz")
async def generate_quiz(payload: dict):
    notebook_id = payload.get("notebook_id", "default")
    num_questions = payload.get("num_questions", 5)

    results = index.query(
        vector=[0.0] * 1024,
        top_k=15,
        include_metadata=True,
        filter={"notebook_id": {"$eq": notebook_id}}
    )

    if not results.matches:
        return {"quiz": []}

    context = "\n\n".join([match.metadata["text"] for match in results.matches])

    prompt = (
        f"You are a helpful study assistant. Generate {num_questions} multiple choice questions based on the study material below.\n\n"
        "Return ONLY a JSON array with no extra text, in this exact format:\n"
        '[{"question": "What is...?", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A"}]\n\n'
        f"Study Material:\n{context}\n\nJSON:"
    )

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    quiz = json.loads(raw)

    return {"quiz": quiz}

@app.post("/notebooks/create")
async def create_notebook(payload: dict):
    notebook_id = str(uuid.uuid4())
    name = payload.get("name", "Untitled Notebook")
    return {"notebook_id": notebook_id, "name": name}