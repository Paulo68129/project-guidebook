
create type public.app_role as enum ('admin','gerente','atendente');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, nome text, created_at timestamptz default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.is_staff(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id) $$;
create or replace function public.is_manager(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role in ('admin','gerente')) $$;

create policy "ver proprio papel ou admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin gerencia papeis" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "staff ve perfis" on public.profiles for select to authenticated using (id = auth.uid() or public.is_manager(auth.uid()));
create policy "atualiza proprio perfil" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,nome) values (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id,role) values (new.id,'admin');
  else
    insert into public.user_roles(user_id,role) values (new.id,'atendente');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.ingredientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, unidade text not null default 'kg',
  quantidade numeric not null default 0, estoque_minimo numeric not null default 0,
  custo_unitario numeric not null default 0, validade date,
  created_at timestamptz default now()
);
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null, categoria text not null default 'pizza',
  descricao text, preco numeric not null default 0, ativo boolean not null default true,
  created_at timestamptz default now()
);
create table public.receitas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete cascade,
  quantidade numeric not null, unique(produto_id, ingrediente_id)
);
create table public.motoboys (
  id uuid primary key default gen_random_uuid(),
  nome text not null, telefone text, ativo boolean not null default true,
  created_at timestamptz default now()
);
create table public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, percentual numeric not null default 10, ativo boolean not null default true
);
create table public.loja_config (
  id int primary key default 1, abre time not null default '18:00', fecha time not null default '23:59',
  aberta_manual boolean, som_alerta boolean not null default true, taxa_entrega numeric not null default 6
);
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  tipo text not null default 'balcao',
  status text not null default 'concluido',
  cliente text, telefone text, endereco text,
  motoboy_id uuid references public.motoboys(id) on delete set null,
  cupom text, desconto numeric not null default 0, taxa_entrega numeric not null default 0,
  subtotal numeric not null default 0, total numeric not null default 0, custo numeric not null default 0,
  lucro numeric not null default 0, criado_por uuid,
  created_at timestamptz not null default now()
);
create table public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null, quantidade int not null, preco_unitario numeric not null, custo_unitario numeric not null default 0
);
create index on public.vendas(created_at);

do $$ declare t text; begin
  foreach t in array array['ingredientes','produtos','receitas','motoboys','cupons','loja_config','vendas','venda_itens'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "staff le" on public.%I for select to authenticated using (public.is_staff(auth.uid()))', t);
  end loop;
  foreach t in array array['ingredientes','produtos','receitas','motoboys','cupons','loja_config'] loop
    execute format('create policy "gerente escreve" on public.%I for all to authenticated using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()))', t);
  end loop;
end $$;
grant usage on sequence public.vendas_numero_seq to authenticated;
create policy "staff atualiza venda" on public.vendas for update to authenticated using (public.is_staff(auth.uid()));
create policy "gerente exclui venda" on public.vendas for delete to authenticated using (public.is_manager(auth.uid()));

create or replace function public.registrar_venda(
  _itens jsonb, _tipo text default 'balcao', _cliente text default null, _telefone text default null,
  _endereco text default null, _cupom text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; it jsonb; p record; r record; v_sub numeric := 0; v_custo numeric := 0; v_custo_item numeric;
  v_desc numeric := 0; v_taxa numeric := 0; v_pct numeric; v_status text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sem permissão'; end if;
  if jsonb_array_length(_itens) = 0 then raise exception 'Carrinho vazio'; end if;
  for it in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id = (it->>'produto_id')::uuid and ativo;
    if not found then raise exception 'Produto indisponível'; end if;
    for r in select i.nome, i.validade from receitas rc join ingredientes i on i.id=rc.ingrediente_id where rc.produto_id=p.id for update of i loop
      if r.validade is not null and r.validade < current_date then
        raise exception 'Ingrediente vencido: %', r.nome; end if;
    end loop;
  end loop;
  for r in select i.nome, i.quantidade as estoque, sum(rc.quantidade * (e->>'quantidade')::numeric) as necessario
           from jsonb_array_elements(_itens) e join receitas rc on rc.produto_id=(e->>'produto_id')::uuid
           join ingredientes i on i.id=rc.ingrediente_id group by i.id, i.nome, i.quantidade loop
    if r.necessario > r.estoque then raise exception 'Estoque insuficiente: %', r.nome; end if;
  end loop;

  v_status := case when _tipo='delivery' then 'novo' else 'concluido' end;
  insert into vendas(tipo,status,cliente,telefone,endereco,criado_por) values(_tipo,v_status,_cliente,_telefone,_endereco,auth.uid()) returning id into v_id;
  for it in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id=(it->>'produto_id')::uuid;
    select coalesce(sum(rc.quantidade*i.custo_unitario),0) into v_custo_item from receitas rc join ingredientes i on i.id=rc.ingrediente_id where rc.produto_id=p.id;
    insert into venda_itens(venda_id,produto_id,nome,quantidade,preco_unitario,custo_unitario)
      values(v_id,p.id,p.nome,(it->>'quantidade')::int,p.preco,v_custo_item);
    v_sub := v_sub + p.preco*(it->>'quantidade')::int;
    v_custo := v_custo + v_custo_item*(it->>'quantidade')::int;
    update ingredientes i set quantidade = i.quantidade - rc.quantidade*(it->>'quantidade')::numeric
      from receitas rc where rc.produto_id=p.id and rc.ingrediente_id=i.id;
  end loop;
  if _cupom is not null and _cupom <> '' then
    select percentual into v_pct from cupons where upper(codigo)=upper(_cupom) and ativo;
    if not found then raise exception 'Cupom inválido'; end if;
    v_desc := round(v_sub*v_pct/100,2);
  end if;
  if _tipo='delivery' then select taxa_entrega into v_taxa from loja_config where id=1; end if;
  update vendas set subtotal=v_sub, desconto=v_desc, cupom=nullif(_cupom,''), taxa_entrega=coalesce(v_taxa,0),
    total=v_sub-v_desc+coalesce(v_taxa,0), custo=v_custo, lucro=v_sub-v_desc-v_custo where id=v_id;
  return v_id;
end $$;
grant execute on function public.registrar_venda(jsonb,text,text,text,text,text) to authenticated;

alter publication supabase_realtime add table public.vendas;

insert into loja_config(id) values (1);
insert into cupons(codigo,percentual) values ('PIZZA10',10),('BEMVINDO15',15);
insert into motoboys(nome,telefone) values ('Carlos Lima','(11) 98888-1111'),('Rafa Souza','(11) 97777-2222'),('Jéssica Alves','(11) 96666-3333');
insert into ingredientes(nome,unidade,quantidade,estoque_minimo,custo_unitario,validade) values
 ('Massa (disco)','un',140,40,2.20,current_date+5),
 ('Molho de tomate','kg',18,5,9.50,current_date+20),
 ('Mussarela','kg',22,8,38.00,current_date+12),
 ('Calabresa','kg',6,4,32.00,current_date+15),
 ('Presunto','kg',3,4,28.00,current_date+3),
 ('Cebola','kg',9,3,5.00,current_date+10),
 ('Frango desfiado','kg',7,3,26.00,current_date+2),
 ('Catupiry','kg',5,2,42.00,current_date+18),
 ('Manjericão','kg',0.8,0.3,60.00,current_date+4),
 ('Tomate','kg',8,3,7.00,current_date+6),
 ('Azeitona','kg',4,1,30.00,current_date+60),
 ('Orégano','kg',1.5,0.3,45.00,current_date+120),
 ('Refrigerante 2L','un',48,12,7.50,current_date+90),
 ('Suco 1L','un',20,6,6.00,current_date+30);
insert into produtos(nome,categoria,descricao,preco) values
 ('Margherita','pizza','Molho, mussarela, tomate e manjericão',54.90),
 ('Calabresa','pizza','Calabresa, cebola e azeitona',52.90),
 ('Portuguesa','pizza','Presunto, cebola, azeitona e mussarela',58.90),
 ('Frango com Catupiry','pizza','Frango desfiado e catupiry',59.90),
 ('Quatro Queijos','pizza','Mussarela e catupiry generosos',62.90),
 ('Refrigerante 2L','bebida','Gelado',14.00),
 ('Suco 1L','bebida','Natural',12.00),
 ('Combo Calabresa + Refri','combo','Pizza calabresa e refrigerante 2L',62.90);
insert into receitas(produto_id,ingrediente_id,quantidade)
select p.id,i.id,x.q from (values
 ('Margherita','Massa (disco)',1),('Margherita','Molho de tomate',0.12),('Margherita','Mussarela',0.25),('Margherita','Tomate',0.1),('Margherita','Manjericão',0.01),('Margherita','Orégano',0.005),
 ('Calabresa','Massa (disco)',1),('Calabresa','Molho de tomate',0.12),('Calabresa','Calabresa',0.2),('Calabresa','Cebola',0.08),('Calabresa','Azeitona',0.03),('Calabresa','Orégano',0.005),
 ('Portuguesa','Massa (disco)',1),('Portuguesa','Molho de tomate',0.12),('Portuguesa','Mussarela',0.2),('Portuguesa','Presunto',0.15),('Portuguesa','Cebola',0.06),('Portuguesa','Azeitona',0.03),
 ('Frango com Catupiry','Massa (disco)',1),('Frango com Catupiry','Molho de tomate',0.12),('Frango com Catupiry','Frango desfiado',0.2),('Frango com Catupiry','Catupiry',0.12),
 ('Quatro Queijos','Massa (disco)',1),('Quatro Queijos','Molho de tomate',0.12),('Quatro Queijos','Mussarela',0.3),('Quatro Queijos','Catupiry',0.15),
 ('Refrigerante 2L','Refrigerante 2L',1),('Suco 1L','Suco 1L',1),
 ('Combo Calabresa + Refri','Massa (disco)',1),('Combo Calabresa + Refri','Molho de tomate',0.12),('Combo Calabresa + Refri','Calabresa',0.2),('Combo Calabresa + Refri','Cebola',0.08),('Combo Calabresa + Refri','Refrigerante 2L',1)
) as x(pn,inome,q) join produtos p on p.nome=x.pn join ingredientes i on i.nome=x.inome;

do $$
declare d int; n int; k int; v uuid; p record; qtd int; hora int; ts timestamptz; v_tipo text;
begin
  for d in 1..60 loop
    n := 12 + (d % 7 in (5,6))::int*10 + floor(random()*8)::int + (60-d)/6;
    for k in 1..n loop
      hora := 18 + floor(random()*5)::int;
      ts := (current_date - d) + make_interval(hours=>hora, mins=>floor(random()*60)::int);
      v_tipo := case when random()<0.55 then 'delivery' else 'balcao' end;
      insert into vendas(tipo,status,created_at,cliente) values (v_tipo, case when v_tipo='delivery' then 'entregue' else 'concluido' end, ts, 'Cliente '||floor(random()*900+100)::int) returning id into v;
      for p in select pr.id, pr.nome, pr.preco, (select coalesce(sum(rc.quantidade*i.custo_unitario),0) from receitas rc join ingredientes i on i.id=rc.ingrediente_id where rc.produto_id=pr.id) as c
               from produtos pr order by random() limit 1 + floor(random()*2)::int loop
        qtd := 1 + floor(random()*2)::int;
        insert into venda_itens(venda_id,produto_id,nome,quantidade,preco_unitario,custo_unitario) values (v,p.id,p.nome,qtd,p.preco,p.c);
      end loop;
      update vendas s set subtotal=x.st, total=x.st + case when v_tipo='delivery' then 6 else 0 end, taxa_entrega=case when v_tipo='delivery' then 6 else 0 end, custo=x.ct, lucro=x.st-x.ct
        from (select sum(vi.quantidade*vi.preco_unitario) st, sum(vi.quantidade*vi.custo_unitario) ct from venda_itens vi where vi.venda_id=v) x where s.id=v;
    end loop;
  end loop;
end $$;
