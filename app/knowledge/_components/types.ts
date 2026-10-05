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

/**
 * What lists and search need: an article, with or without its body. The
 * server hands the first paint these without bodies (an article page has its
 * own route, so a list never renders one), and the live query fills them in.
 */
export type ArticleCard = Omit<Article, "body"> & { body?: Article["body"] };

/** The public Help Center as the server read it, for the first paint before the live queries answer. */
export type InitialHelp = { categories: Category[]; articles: ArticleCard[]; faqs: Faq[] };
