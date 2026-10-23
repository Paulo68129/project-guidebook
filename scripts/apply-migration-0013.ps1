# Script para aplicar a migração 0013_unified_order_flow.sql no Supabase
# ============================================
# Este script oferece duas opções para aplicar a migração:
# 1. Via Supabase CLI (requer login)
# 2. Via psql direto (requer URL de conexão do banco)
#
# Uso:
#   .\scripts\apply-migration-0013.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Aplicar Migração 0013 - Fluxo Unificado" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o arquivo de migração existe
$MigrationFile = "supabase\migrations\0013_unified_order_flow.sql"
if (-not (Test-Path $MigrationFile)) {
    Write-Host "ERRO: Arquivo de migração não encontrado: $MigrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Arquivo de migração encontrado: $MigrationFile" -ForegroundColor Green
Write-Host ""

# Opção 1: Supabase CLI
Write-Host "OPCAO 1: Aplicar via Supabase CLI" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Passo 1: Fazer login no Supabase" -ForegroundColor White
Write-Host "  supabase login" -ForegroundColor Gray
Write-Host ""
Write-Host "Passo 2: Linkar o projeto (se ainda não estiver linkado)" -ForegroundColor White
Write-Host "  supabase link --project-ref lstycewiltrbefrxicdx" -ForegroundColor Gray
Write-Host ""
Write-Host "Passo 3: Aplicar a migração" -ForegroundColor White
Write-Host "  supabase db push" -ForegroundColor Gray
Write-Host ""
Write-Host "OU aplicar apenas esta migração via psql:" -ForegroundColor White
Write-Host "  supabase db shell -f supabase/migrations/0013_unified_order_flow.sql" -ForegroundColor Gray
Write-Host ""

# Opção 2: psql direto
Write-Host "OPCAO 2: Aplicar via psql direto" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Passo 1: Obter a URL de conexão do banco no painel do Supabase" -ForegroundColor White
Write-Host "  Settings > Database > Connection string > URI" -ForegroundColor Gray
Write-Host ""
Write-Host "Passo 2: Aplicar a migração" -ForegroundColor White
Write-Host "  psql \"YOUR_DATABASE_URL\" -f supabase/migrations/0013_unified_order_flow.sql" -ForegroundColor Gray
Write-Host ""

# Opção 3: SQL Editor (Manual)
Write-Host "OPCAO 3: Aplicar via SQL Editor (Manual)" -ForegroundColor Yellow
Write-Host "-----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Passo 1: Acessar o painel do Supabase" -ForegroundColor White
Write-Host "  https://supabase.com/dashboard/project/lstycewiltrbefrxicdx" -ForegroundColor Gray
Write-Host ""
Write-Host "Passo 2: Abrir SQL Editor" -ForegroundColor White
Write-Host "  No menu lateral, clique em 'SQL Editor'" -ForegroundColor Gray
Write-Host ""
Write-Host "Passo 3: Copiar o conteudo do arquivo" -ForegroundColor White
Write-Host "  Abra o arquivo: supabase/migrations/0013_unified_order_flow.sql" -ForegroundColor Gray
Write-Host "  Copie todo o conteudo (294 linhas)" -ForegroundColor Gray
Write-Host ""
Write-Host "Passo 4: Colar e executar" -ForegroundColor White
Write-Host "  Cole no SQL Editor e clique em 'Run'" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  O que a migracao faz:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Atualiza registrar_venda - todos os pedidos entram como 'pendente'" -ForegroundColor White
Write-Host "2. Migra status existentes para o novo padrao" -ForegroundColor White
Write-Host "3. Atualiza aceitar_pedido - vai direto para 'recebido'" -ForegroundColor White
Write-Host "4. Adiciona coluna 'origem' aos pedidos_online" -ForegroundColor White
Write-Host "5. Atualiza pedidos_online existentes" -ForegroundColor White
Write-Host "6. Cria avancar_status_pedido - funcao unificada" -ForegroundColor White
Write-Host ""
Write-Host "Fluxo unificado:" -ForegroundColor Cyan
Write-Host "  Pendente -> Recebido -> Preparando -> Pronto -> Em Entrega -> Finalizado" -ForegroundColor Green
Write-Host ""

# Perguntar ao usuario qual opcao deseja
Write-Host "Escolha uma opcao:" -ForegroundColor Yellow
Write-Host "  1 - Aplicar via Supabase CLI (recomendado)" -ForegroundColor White
Write-Host "  2 - Aplicar via psql direto" -ForegroundColor White
Write-Host "  3 - Apenas mostrar o conteudo da migracao" -ForegroundColor White
Write-Host "  4 - Sair" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Digite o numero da opcao (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Verificando Supabase CLI..." -ForegroundColor Yellow
        
        # Verificar se supabase está instalado
        try {
            $version = supabase --version 2>&1
            Write-Host "Supabase CLI encontrado: $version" -ForegroundColor Green
        }
        catch {
            Write-Host "ERRO: Supabase CLI não encontrado. Instale com: npm install -g supabase" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "Fazendo login no Supabase..." -ForegroundColor Yellow
        supabase login
        
        Write-Host ""
        Write-Host "Linkando o projeto..." -ForegroundColor Yellow
        supabase link --project-ref lstycewiltrbefrxicdx
        
        Write-Host ""
        Write-Host "Aplicando a migracao..." -ForegroundColor Yellow
        supabase db push
        
        Write-Host ""
        Write-Host "Migracao aplicada com sucesso!" -ForegroundColor Green
    }
    "2" {
        Write-Host ""
        Write-Host "URL de conexao do banco:" -ForegroundColor Yellow
        Write-Host "Obtenha no painel do Supabase: Settings > Database > Connection string" -ForegroundColor Yellow
        Write-Host ""
        $dbUrl = Read-Host "Digite a URL de conexao do banco"
        
        if ([string]::IsNullOrWhiteSpace($dbUrl)) {
            Write-Host "ERRO: URL de conexao nao pode ser vazia" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "Aplicando a migracao via psql..." -ForegroundColor Yellow
        psql "$dbUrl" -f $MigrationFile
        
        Write-Host ""
        Write-Host "Migracao aplicada com sucesso!" -ForegroundColor Green
    }
    "3" {
        Write-Host ""
        Write-Host "Conteudo da migracao 0013_unified_order_flow.sql:" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Get-Content $MigrationFile
        Write-Host "========================================" -ForegroundColor Cyan
    }
    "4" {
        Write-Host "Saindo..." -ForegroundColor Yellow
    }
    default {
        Write-Host "Opcao invalida" -ForegroundColor Red
    }
}
