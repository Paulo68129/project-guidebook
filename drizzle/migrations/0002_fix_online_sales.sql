-- Migration: Corrige funções do banco de dados para permitir compras online sem autenticação
-- Executar no Supabase Dashboard > SQL Editor

-- 1. Garante que registrar_venda funcione com service_role (bypass de is_staff)
-- A função já é SECURITY DEFINER, mas verifica is_staff(auth.uid()).
-- Como auth.uid() retorna NULL sem autenticação, is_staff(NULL) = false.
-- Solução: criar uma versão que não exige staff para o fluxo online.

-- 2. Garante que criar_pedido_online e consultar_pedido_online existem e têm permissão anon
-- Estas funções já foram criadas na migration 0001_customer_delivery_catalog,
-- mas garantimos aqui que os grants estão corretos.

-- Re-grant execute para anon nas funções online
GRANT EXECUTE ON FUNCTION public.criar_pedido_online(uuid,text,text,text,jsonb,text) TO anon;
GRANT EXECUTE ON FUNCTION public.consultar_pedido_online(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.catalogo_online() TO anon;

-- 3. Garante que produtos ativos são visíveis publicamente
-- A política já existe, mas garantimos o grant de colunas
GRANT SELECT (id,nome,categoria,descricao,preco,ativo,imagem_path,foto_url) ON public.produtos TO anon;

-- 4. Garante que cupons ativos são consultáveis por anon (para validação na loja online)
CREATE POLICY IF NOT EXISTS "anon ve cupons ativos" ON public.cupons FOR SELECT TO anon USING (ativo);
GRANT SELECT (id,codigo,percentual,ativo) ON public.cupons TO anon;

-- 5. Garante que loja_config é visível por anon (para taxa de entrega e horário)
CREATE POLICY IF NOT EXISTS "anon ve loja config" ON public.loja_config FOR SELECT TO anon USING (true);
GRANT SELECT ON public.loja_config TO anon;

-- 6. Cria função para registrar venda via service role sem verificar staff
-- Esta função é usada pelo backend (server functions) com service_role key
CREATE OR REPLACE FUNCTION public.registrar_venda_online(
  _itens jsonb, _tipo text DEFAULT 'delivery', _cliente text DEFAULT NULL,
  _telefone text DEFAULT NULL, _endereco text DEFAULT NULL, _cupom text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_id uuid; it jsonb; p record; r record; v_sub numeric := 0; v_custo numeric := 0; v_custo_item numeric;
  v_desc numeric := 0; v_taxa numeric := 0; v_pct numeric; v_status text;
begin
  -- NÃO verifica is_staff - permite vendas anônimas via service role
  if jsonb_array_length(_itens) = 0 then raise exception 'Carrinho vazio'; end if;
  
  for it in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id = (it->>'produto_id')::uuid and ativo;
    if not found then raise exception 'Produto indisponível'; end if;
  end loop;
  
  v_status := case when _tipo='delivery' then 'novo' else 'concluido' end;
  insert into vendas(tipo,status,cliente,telefone,endereco)
    values(_tipo,v_status,_cliente,_telefone,_endereco) returning id into v_id;
    
  for it in select * from jsonb_array_elements(_itens) loop
    select * into p from produtos where id=(it->>'produto_id')::uuid;
    select coalesce(sum(rc.quantidade*i.custo_unitario),0) into v_custo_item
      from receitas rc join ingredientes i on i.id=rc.ingrediente_id where rc.produto_id=p.id;
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
  
  update vendas set subtotal=v_sub, desconto=v_desc, cupom=nullif(_cupom,''),
    taxa_entrega=coalesce(v_taxa,0), total=v_sub-v_desc+coalesce(v_taxa,0),
    custo=v_custo, lucro=v_sub-v_desc-v_custo where id=v_id;
    
  return v_id;
end $$;

-- Grant para service_role usar esta função
GRANT EXECUTE ON FUNCTION public.registrar_venda_online(jsonb,text,text,text,text,text) TO service_role;

-- 7. Garante que vendas e venda_itens são consultáveis por service_role
-- (já devem ter grant, mas garantimos)
GRANT ALL ON public.vendas TO service_role;
GRANT ALL ON public.venda_itens TO service_role;
GRANT ALL ON public.ingredientes TO service_role;
GRANT ALL ON public.produtos TO service_role;
GRANT ALL ON public.receitas TO service_role;
GRANT ALL ON public.cupons TO service_role;
GRANT ALL ON public.loja_config TO service_role;
