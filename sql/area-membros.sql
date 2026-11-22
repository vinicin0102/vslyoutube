-- Área de membros (alunos, configurações e uso do chat).
-- O site cria estas tabelas sozinho na primeira vez (pela conexão POSTGRES_URL).
-- Para rodar à mão: Supabase → SQL Editor → New query → Run. Pode rodar mais de uma vez.

create table if not exists public.app_members (
  email      text primary key,
  name       text not null default '',
  pass_hash  text,
  active     boolean not null default true,
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create table if not exists public.app_kv (
  k          text primary key,
  v          jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.app_chat_usage (
  email text not null,
  day   date not null,
  n     int  not null default 0,
  primary key (email, day)
);
alter table public.app_members enable row level security;
alter table public.app_kv enable row level security;
alter table public.app_chat_usage enable row level security;
revoke all on public.app_members, public.app_kv, public.app_chat_usage from anon, authenticated;
