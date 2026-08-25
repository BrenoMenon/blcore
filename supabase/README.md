# Configuração do banco (Supabase)

## 1. Rodar o SQL
No painel do Supabase do projeto `fggsdowcmauxzevwvhcm`:
**SQL Editor → New query** → cole todo o conteúdo de
`supabase/migrations/20260812150000_init_schema.sql` → **Run**.

Ele cria (de forma segura, pode rodar mais de uma vez):
- enums `user_type`, `appointment_status`, `reminder_offset`, `reminder_status`
- tabelas `profiles`, `company_settings`, `services`, `clients`,
  `appointments`, `whatsapp_reminders`, `recovery_keys`
- GRANTs para `anon` / `authenticated` / `service_role` (sem isso a API retorna
  "permission denied" mesmo com RLS correto)
- políticas RLS por usuário (empresa vê só os dados dela, cliente só os dele)
- trigger `on_auth_user_created`: cria o `profiles` (e `company_settings` quando
  é empresa) automaticamente no cadastro — era isso que quebrava o login/criação
  de conta
- bucket de storage `avatars` com políticas por pasta do usuário

> Observação: seu projeto tinha tabelas em português (`servicos`, `clientes`,
> `agendamentos`) que não são usadas pelo app. Elas foram mantidas intactas; o
> app usa as tabelas em inglês criadas pelo script.

## 2. Autenticação
Em **Authentication → Providers → Email**: desative *Confirm email*
(o app faz login logo após o cadastro). Em **Authentication → URL Configuration**,
adicione a URL do site em *Site URL* e *Redirect URLs*.

## 3. Variáveis de ambiente
O arquivo `.env` já aponta para o seu projeto. Falta apenas a chave secreta,
usada só no servidor para a recuperação de senha por pergunta secreta:

```
SUPABASE_SERVICE_ROLE_KEY=<Project Settings → API Keys → secret key>
```

Nunca coloque essa chave em código do navegador (`VITE_*`).
