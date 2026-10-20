"""Testa a chave e o modelo do Gemini uma única vez: python testar_gemini.py"""
import insights

insights.carregar_env()

if not insights.obter_chave():
    raise SystemExit("Chave não encontrada. Cole sua GEMINI_API_KEY no arquivo .env.")

fatos = {"mes_atual": {"faturamento": 1300.0, "vendas": 2},
         "mes_anterior_mesmo_trecho": {"faturamento": 1000.0, "vendas": 2},
         "variacao_faturamento_pct": 30.0, "tem_vendas_com_data": True}

try:
    itens, modelo = insights.chamar_gemini(fatos)
except insights.IAErro as erro:
    raise SystemExit(f"Falhou ({erro.codigo}): {erro.mensagem}")

print(f"OK! Modelo: {modelo}")
for i in itens:
    print(f"- [{i['tipo']}] {i['texto']}")
