-- Métricas da VSL no Supabase.
-- Rode este arquivo inteiro uma vez em: Supabase → SQL Editor → New query → Run.

-- Uma linha por visita; a página atualiza a mesma linha a cada ~15 s de vídeo.
create table if not exists public.vsl_sessions (
  epoch      int         not null default 0,   -- muda ao "Zerar métricas"
  day        date        not null,             -- dia da visita (fuso de Brasília)
  sid        text        not null,             -- id da visita
  uid        text        not null,             -- id do visitante (navegador)
  dev        text        not null default 'd', -- m = celular, d = computador
  src        text        not null default 'direto',
  played     boolean     not null default false,
  max_sec    int         not null default 0,   -- até onde assistiu em sequência
  dur        int         not null default 0,   -- duração do vídeo
  pitch      boolean     not null default false,
  cta        boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (epoch, day, sid)
);

-- Ninguém de fora lê nem escreve: só o servidor do site, com a chave secreta.
alter table public.vsl_sessions enable row level security;
revoke all on public.vsl_sessions from anon, authenticated;

-- Relatório de um período, calculado no banco.
create or replace function public.vsl_report(p_epoch int, p_from date, p_to date)
returns json
language sql
stable
set search_path = public
as $$
  with s as (
    select * from public.vsl_sessions
    where epoch = p_epoch and day between p_from and p_to
  ),
  seg as (
    select 'dev' as kind, dev as name, count(*) as views,
           count(*) filter (where played) as plays, count(*) filter (where cta) as cta
      from s group by dev
    union all
    select 'src', src, count(*), count(*) filter (where played), count(*) filter (where cta)
      from s group by src
  )
  select json_build_object(
    'views',   (select count(*) from s),
    'uniques', (select count(distinct uid) from s),
    'plays',   (select count(*) from s where played),
    'pitch',   (select count(*) from s where pitch),
    'cta',     (select count(*) from s where cta),
    'finish',  (select count(*) from s where played and dur > 0 and (max_sec >= dur - 3 or max_sec >= dur * 0.97)),
    'pct_sum', (select coalesce(sum(least(1.0, max_sec::float / dur)), 0) from s where played and dur > 0),
    'dur',     (select coalesce(max(dur), 0) from s where played),
    'hist',    (select coalesce(json_object_agg(b, n), '{}'::json)
                  from (select max_sec / 5 as b, count(*) as n from s where played group by 1) h),
    'daily',   (select coalesce(json_agg(json_build_object('day', day, 'views', v, 'plays', p, 'cta', c) order by day), '[]'::json)
                  from (select day, count(*) v, count(*) filter (where played) p, count(*) filter (where cta) c
                          from s group by day) d),
    'devices', (select coalesce(json_agg(json_build_object('name', name, 'views', views, 'plays', plays, 'cta', cta) order by views desc), '[]'::json)
                  from seg where kind = 'dev'),
    'sources', (select coalesce(json_agg(json_build_object('name', name, 'views', views, 'plays', plays, 'cta', cta) order by views desc), '[]'::json)
                  from (select * from seg where kind = 'src' order by views desc limit 15) x)
  );
$$;

revoke all on function public.vsl_report(int, date, date) from public, anon, authenticated;
grant execute on function public.vsl_report(int, date, date) to service_role;
