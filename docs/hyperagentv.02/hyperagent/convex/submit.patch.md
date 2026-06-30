# One-line swap in `convex/submissions.ts`

In the `submit` mutation (around line 503), the final step currently triggers the
Airtable pipeline. Point it at Tendso Studio instead.

### Before

```ts
        // 4. Trigger Airtable AI pipeline
        await ctx.scheduler.runAfter(0, internal.airtable.pushToAirtableInternal, {
            submissionId: args.id,
        });
```

### After

```ts
        // 4. Trigger Tendso Studio (Hyperagent) render
        await ctx.scheduler.runAfter(0, internal.hyperagent.triggerStudioRender, {
            submissionId: args.id,
        });
```

That's the only change to existing code. Everything else (status set to
`submitted`, the lead insert, analytics, `airtableSyncStatus: 'pending_push'`) stays
as-is - the studio path reuses the same `airtableSyncStatus` values (`pending_push`
-> `pushed` -> `synced` / `error`) so your existing status UI keeps working.

`convex/airtable.ts` can stay in place (harmless) or be deleted once you've
confirmed the studio path works end to end - `convex/hyperagent.ts` has no
dependency on it.
