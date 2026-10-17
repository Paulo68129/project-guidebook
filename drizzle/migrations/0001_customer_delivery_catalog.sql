ALTER TABLE public.produtos ADD COLUMN imagem_path text;
CREATE POLICY "catalogo produtos ativos" ON public.produtos FOR SELECT TO anon USING (ativo);
GRANT SELECT (id,nome,categoria,descricao,preco,ativo,imagem_path) ON public.produtos TO anon;
CREATE POLICY "fotos leitura catalogo" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'produtos');
CREATE POLICY "gerente adiciona fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produtos' AND public.is_manager(auth.uid()));
CREATE POLICY "gerente altera fotos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'produtos' AND public.is_manager(auth.uid())) WITH CHECK (bucket_id = 'produtos' AND public.is_manager(auth.uid()));
CREATE POLICY "gerente remove fotos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'produtos' AND public.is_manager(auth.uid()));
CREATE TABLE public.pedidos_online (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token uuid NOT NULL UNIQUE,
 cliente text NOT NULL, telefone text NOT NULL, endereco text NOT NULL,
 itens jsonb NOT NULL, subtotal numeric NOT NULL, desconto numeric NOT NULL DEFAULT 0,
 taxa_entrega numeric NOT NULL DEFAULT 0, total numeric NOT NULL, cupom text,
 status text NOT NULL DEFAULT 'aguardando_pagamento', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pedidos_online TO authenticated;
GRANT ALL ON public.pedidos_online TO service_role;
ALTER TABLE public.pedidos_online ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff consulta pedidos online" ON public.pedidos_online FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE FUNCTION public.catalogo_online() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object('produtos', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'categoria',categoria,'descricao',descricao,'preco',preco,'imagem_path',imagem_path) ORDER BY categoria,nome) FROM produtos WHERE ativo),'[]'::jsonb),'taxa_entrega',coalesce((SELECT taxa_entrega FROM loja_config WHERE id=1),0),'abre',(SELECT abre FROM loja_config WHERE id=1),'fecha',(SELECT fecha FROM loja_config WHERE id=1),'aberta_manual',(SELECT aberta_manual FROM loja_config WHERE id=1));
$$;
GRANT EXECUTE ON FUNCTION public.catalogo_online() TO anon, authenticated;
CREATE FUNCTION public.criar_pedido_online(_token uuid, _cliente text, _telefone text, _endereco text, _itens jsonb, _cupom text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; e jsonb; snap jsonb := '[]'; sub numeric := 0; pct numeric := 0; fee numeric; disc numeric; result jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(_token::text));
 SELECT to_jsonb(o)-'token' INTO result FROM pedidos_online o WHERE token=_token;
 IF result IS NOT NULL THEN RETURN result; END IF;
 IF length(trim(_cliente))<2 OR length(_cliente)>120 OR length(trim(_telefone))<8 OR length(_telefone)>30 OR length(trim(_endereco))<8 OR length(_endereco)>500 THEN RAISE EXCEPTION 'Informe nome, telefone e endereço completos'; END IF;
 IF jsonb_typeof(_itens)!='array' OR jsonb_array_length(_itens)<1 OR jsonb_array_length(_itens)>50 THEN RAISE EXCEPTION 'Carrinho inválido'; END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(_itens) LOOP
  IF (e->>'quantidade')::int NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT * INTO p FROM produtos WHERE id=(e->>'produto_id')::uuid AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
  sub:=sub+p.preco*(e->>'quantidade')::int;
  snap:=snap||jsonb_build_array(jsonb_build_object('nome',p.nome,'produto_id',p.id,'quantidade',(e->>'quantidade')::int,'preco_unitario',p.preco));
 END LOOP;
 IF trim(_cupom)<>'' THEN
  SELECT percentual INTO pct FROM cupons WHERE upper(codigo)=upper(trim(_cupom)) AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cupom inválido'; END IF;
 END IF;
 SELECT taxa_entrega INTO fee FROM loja_config WHERE id=1;
 disc:=round(sub*pct/100,2);
 INSERT INTO pedidos_online(token,cliente,telefone,endereco,itens,subtotal,desconto,taxa_entrega,total,cupom) VALUES(_token,trim(_cliente),trim(_telefone),trim(_endereco),snap,sub,disc,coalesce(fee,0),sub-disc+coalesce(fee,0),nullif(trim(_cupom),'')) RETURNING to_jsonb(pedidos_online)-'token' INTO result;
 RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.criar_pedido_online(uuid,text,text,text,jsonb,text) TO anon, authenticated;
CREATE FUNCTION public.consultar_pedido_online(_token uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT to_jsonb(o)-'token' FROM pedidos_online o WHERE token=_token $$;
GRANT EXECUTE ON FUNCTION public.consultar_pedido_online(uuid) TO anon, authenticated;