-- Ejecutar UNA vez en Supabase SQL Editor
-- Crea la tabla de clasificaciones IA SIN tocar la tabla apuntes

create table if not exists apuntes_clasificaciones (
  apunte_id          bigint primary key references apuntes(id) on delete cascade,
  resultado          text    not null,
  confianza          float8,
  todas_las_probabilidades jsonb,
  clasificado_en     timestamptz default now()
);

-- Índice para búsquedas por resultado
create index if not exists idx_apuntes_clas_resultado
  on apuntes_clasificaciones (resultado);
