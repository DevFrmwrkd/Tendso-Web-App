import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";

// Registers the Convex AI Agent component (@convex-dev/agent). It creates its
// own namespaced tables (threads/messages/etc.) under `components.agent` and
// does NOT touch the app schema (knowledgeArticles, by_embedding, aiKeys, ...).
// See docs/… migration plan; prod deploy is gated on confirming the mobile
// app's deploy topology (shared deployment: energetic-panther-693).
const app = defineApp();
app.use(agent);
export default app;
