// Gerado a partir de sql/supabase-metricas.sql — mantenha os dois iguais.
export const SCHEMA_SQL = `-- Métricas da VSL e da página de vendas no Supabase.
-- O site roda este arquivo sozinho quando precisa (pela conexão POSTGRES_URL da
-- integração). Para rodar à mão: Supabase → SQL Editor → New query → Run.
-- Pode rodar quantas vezes quiser.

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
  pitch      boolean     not null default false, -- chegou no pitch (VSL) ou na oferta (página de vendas)
  cta        boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (epoch, day, sid)
);
-- Qual página: 'vsl' (/) ou 'oferta' (/oferta, página de vendas).
alter table public.vsl_sessions add column if not exists page text not null default 'vsl';

-- Ninguém de fora lê nem escreve: só o servidor do site, com a chave secreta.
alter table public.vsl_sessions enable row level security;
revoke all on public.vsl_sessions from anon, authenticated;

-- Grava uma visita. Só acumula: play, pitch e clique nunca são desmarcados e o
-- tempo assistido só aumenta — envios que chegam fora de ordem não apagam nada.
create or replace function public.vsl_track(
  p_epoch int, p_day date, p_sid text, p_uid text, p_dev text, p_src text,
  p_played boolean, p_max_sec int, p_dur int, p_pitch boolean, p_cta boolean, p_page text
) returns void
language sql
set search_path = public
as $$
  insert into public.vsl_sessions as v (epoch, day, sid, uid, dev, src, played, max_sec, dur, pitch, cta, page)
  values (p_epoch, p_day, p_sid, p_uid, p_dev, p_src, p_played, p_max_sec, p_dur, p_pitch, p_cta, p_page)
  on conflict (epoch, day, sid) do update set
    played     = v.played or excluded.played,
    max_sec    = greatest(v.max_sec, excluded.max_sec),
    dur        = greatest(v.dur, excluded.dur),
    pitch      = v.pitch or excluded.pitch,
    cta        = v.cta or excluded.cta,
    updated_at = now();
$$;

revoke all on function public.vsl_track(int, date, text, text, text, text, boolean, int, int, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.vsl_track(int, date, text, text, text, text, boolean, int, int, boolean, boolean, text) to service_role;

-- Relatório de um período e de uma página, calculado no banco.
create or replace function public.vsl_report(p_epoch int, p_from date, p_to date, p_page text)
returns json
language sql
stable
set search_path = public
as $$
  with s as (
    select * from public.vsl_sessions
    where epoch = p_epoch and day between p_from and p_to and page = p_page
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

revoke all on function public.vsl_report(int, date, date, text) from public, anon, authenticated;
grant execute on function public.vsl_report(int, date, date, text) to service_role;

-- Avisa a API do Supabase para enxergar as mudanças na hora.
notify pgrst, 'reload schema';
`;
