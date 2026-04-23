create extension if not exists "pgcrypto";

create table if not exists teb_classes (
  id uuid primary key,
  library_id text not null,
  class_type text not null,
  name_in_model text not null,
  header text not null,
  description text not null default '',
  image_name text not null default '',
  image_url text,
  gpss_model_text text not null default '',
  gpss_model_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teb_gpss_entities (
  id uuid primary key,
  class_id uuid not null references teb_classes(id) on delete cascade,
  sort_order integer not null,
  type text not null,
  name_in_model text not null,
  value text not null default '',
  description text not null default ''
);

create table if not exists teb_ports (
  id uuid primary key,
  class_id uuid not null references teb_classes(id) on delete cascade,
  direction text not null check (direction in ('input', 'output')),
  sort_order integer not null,
  name_in_model text not null,
  header text not null,
  connected_block text not null default '',
  connections_limit text not null default '',
  description text not null default ''
);

create table if not exists teb_parameters (
  id uuid primary key,
  class_id uuid not null references teb_classes(id) on delete cascade,
  sort_order integer not null,
  type text not null,
  header text not null,
  name_in_model text not null,
  default_value text not null default '',
  allow_empty_values boolean not null default false,
  current_value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teb_states (
  id uuid primary key,
  class_id uuid not null references teb_classes(id) on delete cascade,
  sort_order integer not null,
  name text not null,
  expression text not null default '',
  description text not null default ''
);

create table if not exists teb_instances (
  id uuid primary key,
  class_id uuid not null references teb_classes(id) on delete cascade,
  name_in_model text not null,
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teb_instance_parameter_values (
  instance_id uuid not null references teb_instances(id) on delete cascade,
  parameter_id uuid not null references teb_parameters(id) on delete cascade,
  value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (instance_id, parameter_id)
);

insert into teb_classes (
  id, library_id, class_type, name_in_model, header, description, gpss_model_text, gpss_model_metadata
)
values (
  '3ef71b95-07f7-41c6-b532-03d83d8a3973',
  '0',
  'SimpleTebClass',
  'BI_U_3',
  'Блок-участок 2',
  'Поезд ожидает входа на участок. После освобождения блок-участка предыдущим составом поезд входит на него. После прохождения участка поезд следует на станцию прибытия.',
  E'; Блок-участок\nQUEUE     BU3_Q\nSEIZE     BU3\nDEPART    BU3_Q\nADVANCE   travelTime\nRELEASE   BU3\nTRANSFER  ,NEXT_STATION',
  '{"source":"seed","ui":"gp ss-studio"}'::jsonb
)
on conflict (id) do nothing;

insert into teb_gpss_entities (id, class_id, sort_order, type, name_in_model, value, description)
values
  ('10000000-0000-0000-0000-000000000001', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 0, 'Queue', 'BU3_Q', '', 'Очередь ожидания входа на блок-участок'),
  ('10000000-0000-0000-0000-000000000002', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 1, 'Facility', 'BU3', '', 'Устройство блок-участка')
on conflict (id) do nothing;

insert into teb_ports (id, class_id, direction, sort_order, name_in_model, header, connected_block, connections_limit, description)
values
  ('20000000-0000-0000-0000-000000000001', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 'input', 0, 'IN', 'Вход', 'QUEUE', '1', 'Вход транзактов на участок'),
  ('20000000-0000-0000-0000-000000000002', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 'output', 0, 'OUT', 'Выход', 'TRANSFER', '1', 'Переход к следующему участку')
on conflict (id) do nothing;

insert into teb_parameters (id, class_id, sort_order, type, header, name_in_model, default_value, allow_empty_values, current_value)
values
  ('30000000-0000-0000-0000-000000000001', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 0, 'NumberParameterType', 'Время прохода', 'travelTime', '5', false, '6'),
  ('30000000-0000-0000-0000-000000000002', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 1, 'NameOrPartParameterType', 'Следующая станция', 'NEXT_STATION', 'ARRIVAL', false, 'ARRIVAL')
on conflict (id) do nothing;

insert into teb_states (id, class_id, sort_order, name, expression, description)
values
  ('40000000-0000-0000-0000-000000000001', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 0, 'Busy', 'F$BU3 = 1', 'Участок занят'),
  ('40000000-0000-0000-0000-000000000002', '3ef71b95-07f7-41c6-b532-03d83d8a3973', 1, 'QueueLength', 'Q$BU3_Q', 'Длина очереди перед участком')
on conflict (id) do nothing;

insert into teb_instances (id, class_id, name_in_model, text)
values (
  '80ba15bc-7a4a-4b36-ba57-df2cab3b89ad',
  '3ef71b95-07f7-41c6-b532-03d83d8a3973',
  'BI_U_3_01',
  'Экземпляр ТЭБа для локального стенда'
)
on conflict (id) do nothing;

insert into teb_instance_parameter_values (instance_id, parameter_id, value)
values
  ('80ba15bc-7a4a-4b36-ba57-df2cab3b89ad', '30000000-0000-0000-0000-000000000001', '6'),
  ('80ba15bc-7a4a-4b36-ba57-df2cab3b89ad', '30000000-0000-0000-0000-000000000002', 'ARRIVAL')
on conflict (instance_id, parameter_id) do nothing;
