import KnowledgeApp from "./_components/KnowledgeApp";

// The Tendso Knowledge Base — faithful build of the Claude Design handoff.
// Two workspaces (public Help Center + gated field-agent Wiki), ⌘K command
// palette, and grounded "Tendso AI" answers (Convex + Gemini RAG).
// Self-contained styling lives in app/knowledge/knowledge.css (scoped to .tkb).
export default function KnowledgePage() {
    return <KnowledgeApp />;
}
