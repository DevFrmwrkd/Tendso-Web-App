import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

/** UI types derived directly from the Convex function return types. */
export type Workspace = "help" | "wiki";

export type Category = FunctionReturnType<typeof api.knowledge.listCategories>[number];
export type Article = FunctionReturnType<typeof api.knowledge.listArticles>[number];
export type Faq = FunctionReturnType<typeof api.knowledge.listFaqs>[number];
export type AskResult = FunctionReturnType<typeof api.knowledgeAI.ask>;

/** A single body block (discriminated on `t`). */
export type Block = Article["body"][number];
