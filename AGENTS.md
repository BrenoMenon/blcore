<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Projeto importado (BL Core Gestão)
- App importado de pasta externa; backend continua no Supabase próprio configurado em src/integrations/supabase/project-config.ts (chaves públicas).
- Endpoint Express original virou rota TanStack em src/routes/api/gemini/organize-budget.ts; sem GEMINI_API_KEY usa o parser local.
- tsconfig afrouxado (exactOptionalPropertyTypes/noUncheckedIndexedAccess off) para compatibilidade com o código importado.
