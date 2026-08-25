# Arquivos ausentes no ZIP

Este documento lista o que foi intencionalmente excluído do arquivo `.zip` e como recuperar cada item.

## 1. `.env` (variáveis de ambiente)
**Status:** não existe no projeto atual / não incluído por segurança.

O arquivo `.env` contém a chave secreta do Supabase (`SUPABASE_SERVICE_ROLE_KEY`). Ele está no `.gitignore` e nunca deve ser enviado em repositórios ou arquivos compactados.

**Substituto incluído:** `.env.example` — contém todas as variáveis necessárias, com valores públicos preenchidos e placeholders para secrets.

**Para rodar o projeto localmente:**
1. Copie `.env.example` para `.env`.
2. No painel do Supabase, vá em **Project Settings → API → service_role key**.
3. Cole essa chave em `SUPABASE_SERVICE_ROLE_KEY` no `.env`.

## 2. `node_modules/`
**Motivo:** pode ser regenerado com o gerenciador de pacotes.

```bash
bun install
# ou, se preferir npm:
# npm install
```

## 3. `dist/`
**Motivo:** build de produção gerado automaticamente.

```bash
bun run build
```

## 4. `.wrangler/` e `.dev.vars`
**Motivo:** caches e variáveis locais do Wrangler/Cloudflare.

## 5. `.git/`
**Motivo:** histórico do Git não é necessário para deploy.

## 6. `.tanstack/`, `.nitro/`, `.output/`, `.vinxi/`
**Motivo:** diretórios de cache/build do TanStack Start.

## Resumo rápido

Para colocar o projeto para rodar a partir do ZIP:

```bash
cp .env.example .env
# edite .env e insira SUPABASE_SERVICE_ROLE_KEY
bun install
bun run dev
```

> **Atenção:** o projeto já está apontando para o Supabase real do projeto `fggsdowcmauxzevwvhcm`. Não é necessário recriar o banco, apenas garantir que a `SUPABASE_SERVICE_ROLE_KEY` esteja correta para as funções administrativas (ex.: exclusão de conta).
