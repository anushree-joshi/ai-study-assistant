"use client";
import { useState } from "react";

export default function Home() {
  const [notebooks, setNotebooks] = useState<{id: string, name: string}[]>([
    { id: "default", name: "Default Notebook" }
  ]);
  const [activeNotebook, setActiveNotebook] = useState("default");
  const [newNotebookName, setNewNotebookName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [quiz, setQuiz] = useState<any[]>([]);
  const [quizzing, setQuizzing] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<{[key: number]: string}>({});
  const [tab, setTab] = useState<"chat" | "summary" | "quiz">("chat");

  const createNotebook = async () => {
    if (!newNotebookName.trim()) return;
    const res = await fetch("https://ai-study-assistant-production-46ea.up.railway.app/notebooks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newNotebookName }),
    });
    const data = await res.json();
    setNotebooks(prev => [...prev, { id: data.notebook_id, name: newNotebookName }]);
    setActiveNotebook(data.notebook_id);
    setNewNotebookName("");
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`https://ai-study-assistant-production-46ea.up.railway.app/upload?notebook_id=${activeNotebook}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploadResult(data);
    setUploading(false);
  };

  const handleChat = async () => {
    if (!question.trim()) return;
    const userMessage = { role: "user", content: question };
    setMessages(prev => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);
    const res = await fetch("https://ai-study-assistant-production-46ea.up.railway.app/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, notebook_id: activeNotebook }),
    });
    const data = await res.json();
    setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    setLoading(false);
  };

  const handleSummary = async () => {
    setSummarizing(true);
    setSummary("");
    const res = await fetch("https://ai-study-assistant-production-46ea.up.railway.app/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebook_id: activeNotebook }),
    });
    const data = await res.json();
    setSummary(data.summary);
    setSummarizing(false);
  };

  const handleQuiz = async () => {
    setQuizzing(true);
    setQuiz([]);
    setSelectedAnswers({});
    const res = await fetch("https://ai-study-assistant-production-46ea.up.railway.app/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebook_id: activeNotebook, num_questions: 5 }),
    });
    const data = await res.json();
    setQuiz(data.quiz);
    setQuizzing(false);
  };

  const activeNotebookName = notebooks.find(n => n.id === activeNotebook)?.name;

  return (
    <main className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-6 text-black">📚 Study Assistant</h1>

        <p className="text-xs text-black uppercase font-semibold mb-2">Notebooks</p>
        {notebooks.map(nb => (
          <button
            key={nb.id}
            onClick={() => { setActiveNotebook(nb.id); setMessages([]); setUploadResult(null); setSummary(""); setQuiz([]); }}
            className={`text-left px-3 py-2 rounded-lg mb-1 text-sm ${activeNotebook === nb.id ? "bg-blue-500 text-white" : "hover:bg-gray-100 text-black"}`}
          >
            📓 {nb.name}
          </button>
        ))}

        <div className="mt-4">
          <input
            type="text"
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createNotebook()}
            placeholder="New notebook..."
            className="w-full border rounded px-2 py-1 text-sm mb-1 text-black"
          />
          <button
            onClick={createNotebook}
            className="w-full bg-gray-100 hover:bg-gray-200 text-sm py-1 rounded text-black"
          >
            + Create
          </button>
        </div>

        {/* Upload */}
        <div className="mt-6 border-t pt-4">
          <p className="text-xs text-black uppercase font-semibold mb-2">Upload PDF</p>
          <label className="w-full cursor-pointer bg-gray-100 hover:bg-gray-200 text-sm py-2 rounded text-center block mb-2 text-black">
            {file ? file.name : "📄 Choose PDF"}
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-500 text-white text-sm py-1 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {uploading ? "Processing..." : "Upload"}
          </button>
          {uploadResult && (
            <p className="text-xs text-green-600 mt-1">✅ {uploadResult.total_chunks} chunks ready</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-black">{activeNotebookName}</h2>
          <div className="flex gap-2">
            {["chat", "summary", "quiz"].map(t => (
              <button
                key={t}
                onClick={() => setTab(t as any)}
                className={`px-4 py-1 rounded-full text-sm capitalize ${tab === t ? "bg-blue-500 text-white" : "bg-white border hover:bg-gray-50 text-black"}`}
              >
                {t === "chat" ? "💬 Chat" : t === "summary" ? "📝 Summary" : "🧠 Quiz"}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Tab */}
        {tab === "chat" && (
          <div className="flex flex-col flex-1">
            <div className="flex-1 bg-white rounded-xl border p-4 mb-4 min-h-96 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-black text-center mt-16">Upload a PDF and ask anything about it...</p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                  <span className={`inline-block px-4 py-2 rounded-xl max-w-xl text-left text-sm ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-black"}`}>
                    {msg.content}
                  </span>
                </div>
              ))}
              {loading && (
                <div className="text-left">
                  <span className="inline-block px-4 py-2 rounded-xl bg-gray-100 text-black text-sm">Thinking...</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChat()}
                placeholder="Ask a question about your notes..."
                className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
              <button
                onClick={handleChat}
                disabled={!question.trim() || loading}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Ask
              </button>
            </div>
          </div>
        )}

        {/* Summary Tab */}
        {tab === "summary" && (
          <div className="bg-white rounded-xl border p-6">
            <button
              onClick={handleSummary}
              disabled={summarizing}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 mb-4"
            >
              {summarizing ? "Generating Summary..." : "Generate Summary"}
            </button>
            {summary && (
              <div className="text-sm text-black whitespace-pre-wrap">
                {summary}
              </div>
            )}
          </div>
        )}

        {/* Quiz Tab */}
        {tab === "quiz" && (
          <div className="bg-white rounded-xl border p-6">
            <button
              onClick={handleQuiz}
              disabled={quizzing}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 mb-6"
            >
              {quizzing ? "Generating Quiz..." : "Generate Quiz"}
            </button>
            {quiz.map((q, i) => (
              <div key={i} className="mb-6">
                <p className="font-medium mb-2 text-black">{i + 1}. {q.question}</p>
                <div className="flex flex-col gap-1">
                  {q.options.map((opt: string) => {
                    const letter = opt[0];
                    const isSelected = selectedAnswers[i] === letter;
                    const isCorrect = letter === q.answer;
                    const showResult = selectedAnswers[i] !== undefined;
                    return (
                      <button
                        key={opt}
                        onClick={() => setSelectedAnswers(prev => ({...prev, [i]: letter}))}
                        className={`text-left px-4 py-2 rounded-lg border text-sm text-black ${
                          !showResult ? "hover:bg-gray-50" :
                          isCorrect ? "bg-green-100 border-green-400 text-green-800" :
                          isSelected ? "bg-red-100 border-red-400 text-red-800" : ""
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}