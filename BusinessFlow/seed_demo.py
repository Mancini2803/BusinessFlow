"""
Preenche o banco com dados FICTÍCIOS para demonstração.

    python seed_demo.py           (só roda se o banco estiver vazio)
    python seed_demo.py --limpar  (apaga tudo e recria os dados de exemplo)
"""
import random
import sys
from datetime import date, datetime, timedelta

import app as sistema

PRODUTOS = [
    ("Tênis Runner", 349.90, 14),
    ("Camiseta Básica", 79.90, 40),
    ("Calça Jeans", 189.90, 22),
    ("Boné Urbano", 59.90, 3),
    ("Mochila 20L", 159.90, 9),
    ("Meia Esportiva", 24.90, 60),
]

CLIENTES = [
    ("Ana Souza", "ana.souza@exemplo.com", "(11) 91234-5678"),
    ("Bruno Lima", "bruno.lima@exemplo.com", "(11) 98765-4321"),
    ("Carla Mendes", "carla.mendes@exemplo.com", "(21) 99876-1122"),
    ("Diego Ramos", "diego.ramos@exemplo.com", "(31) 98888-7766"),
    ("Elisa Prado", "elisa.prado@exemplo.com", "(41) 97777-3344"),
]


def main():
    limpar = "--limpar" in sys.argv
    sistema.criar_banco()
    con = sistema.conectar_banco()

    if con.execute("SELECT COUNT(*) FROM vendas").fetchone()[0] and not limpar:
        raise SystemExit("O banco já tem vendas. Use --limpar para recriar os dados de exemplo.")

    for tabela in ("vendas", "produtos", "clientes", "analises_ia"):
        con.execute(f"DELETE FROM {tabela}")

    agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for nome, preco, estoque in PRODUTOS:
        con.execute("INSERT INTO produtos (nome, preco, estoque) VALUES (?, ?, ?)", (nome, preco, estoque))
    for nome, email, tel in CLIENTES:
        con.execute("INSERT INTO clientes (nome, email, telefone, criado_em) VALUES (?, ?, ?, ?)",
                    (nome, email, tel, agora))

    ids = [r["id"] for r in con.execute("SELECT id FROM clientes")]
    rnd = random.Random(42)                       # mesmos dados sempre
    hoje = date.today()
    total = 0

    for dias_atras in range(180, -1, -1):
        dia = hoje - timedelta(days=dias_atras)
        crescimento = 1 + (180 - dias_atras) / 180   # negócio crescendo
        for _ in range(int(rnd.random() * 1.6 * crescimento)):
            # Tênis e Camiseta vendem mais
            nome, preco, _e = rnd.choices(PRODUTOS, weights=[4, 5, 3, 2, 2, 3])[0]
            qtd = rnd.choice([1, 1, 1, 2, 3])
            cliente = rnd.choice(ids) if rnd.random() < 0.7 else None
            hora = f"{rnd.randint(9, 19):02d}:{rnd.randint(0, 59):02d}:00"
            con.execute(
                "INSERT INTO vendas (produto, valor, quantidade, data, cliente_id) VALUES (?, ?, ?, ?, ?)",
                (nome, preco, qtd, f"{dia.isoformat()} {hora}", cliente))
            total += 1

    con.commit()
    con.close()
    print(f"Pronto: {len(PRODUTOS)} produtos, {len(CLIENTES)} clientes e {total} vendas de exemplo.")


if __name__ == "__main__":
    main()
