from flask import Flask, jsonify, request, render_template
import re
import sqlite3

app = Flask(__name__)

BANCO = "database.db"


def conectar_banco():
    conexao = sqlite3.connect(BANCO)
    conexao.row_factory = sqlite3.Row
    return conexao


def criar_banco():
    conexao = conectar_banco()

    conexao.execute("""
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto TEXT NOT NULL,
            valor REAL NOT NULL,
            quantidade INTEGER NOT NULL
        )
    """)

    conexao.execute("""
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
            preco REAL NOT NULL,
            estoque INTEGER NOT NULL DEFAULT 0
        )
    """)

    conexao.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT,
            telefone TEXT,
            criado_em TEXT
        )
    """)

    # Migração: adiciona a coluna de data se o banco for da versão antiga.
    # Vendas antigas ficam com data NULL (não entram no gráfico mensal).
    colunas = [c["name"] for c in conexao.execute("PRAGMA table_info(vendas)")]
    if "data" not in colunas:
        conexao.execute("ALTER TABLE vendas ADD COLUMN data TEXT")
    if "cliente_id" not in colunas:
        conexao.execute("ALTER TABLE vendas ADD COLUMN cliente_id INTEGER")

    conexao.commit()
    conexao.close()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/vendas")
def pagina_vendas():
    return render_template("vendas.html")


@app.route("/relatorios")
def pagina_relatorios():
    return render_template("relatorios.html")


@app.route("/clientes")
def pagina_clientes():
    return render_template("clientes.html")


@app.route("/produtos")
def pagina_produtos():
    return render_template("produtos.html")


@app.route("/api/vendas", methods=["POST"])
def cadastrar_venda():

    dados = request.get_json(silent=True) or {}

    try:
        produto = str(dados["produto"]).strip()
        valor = float(dados["valor"])
        quantidade = int(dados["quantidade"])
        cliente_id = dados.get("cliente_id")
        cliente_id = None if cliente_id in (None, "") else int(cliente_id)
    except (KeyError, TypeError, ValueError):
        return jsonify({"erro": "Dados inválidos."}), 400

    if not produto or valor <= 0 or quantidade <= 0:
        return jsonify({"erro": "Informe produto, valor e quantidade válidos."}), 400

    conexao = conectar_banco()

    if cliente_id is not None:
        existe = conexao.execute(
            "SELECT 1 FROM clientes WHERE id = ?", (cliente_id,)
        ).fetchone()

        if not existe:
            conexao.close()
            return jsonify({"erro": "Cliente não encontrado."}), 400

    conexao.execute("""
        INSERT INTO vendas (produto, valor, quantidade, data, cliente_id)
        VALUES (?, ?, ?, datetime('now', 'localtime'), ?)
    """, (produto, valor, quantidade, cliente_id))

    conexao.commit()
    conexao.close()

    return jsonify({
        "mensagem": "Venda cadastrada com sucesso!"
    }), 201


@app.route("/api/vendas", methods=["GET"])
def buscar_vendas():

    conexao = conectar_banco()

    vendas = conexao.execute("""
        SELECT v.*, c.nome AS cliente_nome
        FROM vendas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
    """).fetchall()

    conexao.close()

    return jsonify([
        dict(venda)
        for venda in vendas
    ])


@app.route("/api/vendas/<int:venda_id>", methods=["DELETE"])
def excluir_venda(venda_id):

    conexao = conectar_banco()

    resultado = conexao.execute(
        "DELETE FROM vendas WHERE id = ?", (venda_id,)
    )

    conexao.commit()
    conexao.close()

    if resultado.rowcount == 0:
        return jsonify({"erro": "Venda não encontrada."}), 404

    return jsonify({"mensagem": "Venda excluída com sucesso!"})


# ================= PRODUTOS =================

def ler_produto(dados):
    """Valida o JSON recebido. Levanta ValueError se algo estiver errado."""
    try:
        nome = str(dados["nome"]).strip()
        preco = float(dados["preco"])
        estoque = int(dados["estoque"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("Dados inválidos.")

    if not nome or preco <= 0 or estoque < 0:
        raise ValueError("Informe nome, preço (maior que zero) e estoque (zero ou mais).")

    return nome, preco, estoque


@app.route("/api/produtos", methods=["GET"])
def buscar_produtos():

    conexao = conectar_banco()

    produtos = conexao.execute("""
        SELECT * FROM produtos ORDER BY nome
    """).fetchall()

    conexao.close()

    return jsonify([dict(produto) for produto in produtos])


@app.route("/api/produtos", methods=["POST"])
def cadastrar_produto():

    try:
        nome, preco, estoque = ler_produto(request.get_json(silent=True) or {})
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    conexao = conectar_banco()

    try:
        cursor = conexao.execute("""
            INSERT INTO produtos (nome, preco, estoque)
            VALUES (?, ?, ?)
        """, (nome, preco, estoque))
        conexao.commit()
        novo_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Já existe um produto com esse nome."}), 409
    finally:
        conexao.close()

    return jsonify({"mensagem": "Produto cadastrado com sucesso!", "id": novo_id}), 201


@app.route("/api/produtos/<int:produto_id>", methods=["PUT"])
def editar_produto(produto_id):

    try:
        nome, preco, estoque = ler_produto(request.get_json(silent=True) or {})
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    conexao = conectar_banco()

    try:
        resultado = conexao.execute("""
            UPDATE produtos SET nome = ?, preco = ?, estoque = ?
            WHERE id = ?
        """, (nome, preco, estoque, produto_id))
        conexao.commit()
        encontrado = resultado.rowcount > 0
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Já existe um produto com esse nome."}), 409
    finally:
        conexao.close()

    if not encontrado:
        return jsonify({"erro": "Produto não encontrado."}), 404

    return jsonify({"mensagem": "Produto atualizado com sucesso!"})


@app.route("/api/produtos/<int:produto_id>", methods=["DELETE"])
def excluir_produto(produto_id):

    conexao = conectar_banco()

    resultado = conexao.execute(
        "DELETE FROM produtos WHERE id = ?", (produto_id,)
    )

    conexao.commit()
    conexao.close()

    if resultado.rowcount == 0:
        return jsonify({"erro": "Produto não encontrado."}), 404

    return jsonify({"mensagem": "Produto excluído com sucesso!"})


# ================= CLIENTES =================

EMAIL_VALIDO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TELEFONE_VALIDO = re.compile(r"^[\d\s()+-]{8,20}$")


def ler_cliente(dados):
    """Valida o JSON recebido. Levanta ValueError se algo estiver errado."""
    try:
        nome = str(dados["nome"]).strip()
    except (KeyError, TypeError):
        raise ValueError("Informe o nome do cliente.")

    email = str(dados.get("email") or "").strip()
    telefone = str(dados.get("telefone") or "").strip()

    if not nome:
        raise ValueError("Informe o nome do cliente.")
    if len(nome) > 120:
        raise ValueError("O nome é muito longo.")
    if email and not EMAIL_VALIDO.match(email):
        raise ValueError("E-mail inválido.")
    if telefone and not TELEFONE_VALIDO.match(telefone):
        raise ValueError("Telefone inválido.")

    return nome, email or None, telefone or None


@app.route("/api/clientes", methods=["GET"])
def buscar_clientes():

    conexao = conectar_banco()

    clientes = conexao.execute("""
        SELECT c.*,
               COUNT(v.id) AS compras,
               COALESCE(SUM(v.valor * v.quantidade), 0) AS total_gasto
        FROM clientes c
        LEFT JOIN vendas v ON v.cliente_id = c.id
        GROUP BY c.id
        ORDER BY c.nome COLLATE NOCASE
    """).fetchall()

    conexao.close()

    return jsonify([dict(cliente) for cliente in clientes])


@app.route("/api/clientes", methods=["POST"])
def cadastrar_cliente():

    try:
        nome, email, telefone = ler_cliente(request.get_json(silent=True) or {})
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    conexao = conectar_banco()

    cursor = conexao.execute("""
        INSERT INTO clientes (nome, email, telefone, criado_em)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
    """, (nome, email, telefone))

    conexao.commit()
    novo_id = cursor.lastrowid
    conexao.close()

    return jsonify({"mensagem": "Cliente cadastrado com sucesso!", "id": novo_id}), 201


@app.route("/api/clientes/<int:cliente_id>", methods=["PUT"])
def editar_cliente(cliente_id):

    try:
        nome, email, telefone = ler_cliente(request.get_json(silent=True) or {})
    except ValueError as erro:
        return jsonify({"erro": str(erro)}), 400

    conexao = conectar_banco()

    resultado = conexao.execute("""
        UPDATE clientes SET nome = ?, email = ?, telefone = ?
        WHERE id = ?
    """, (nome, email, telefone, cliente_id))

    conexao.commit()
    conexao.close()

    if resultado.rowcount == 0:
        return jsonify({"erro": "Cliente não encontrado."}), 404

    return jsonify({"mensagem": "Cliente atualizado com sucesso!"})


@app.route("/api/clientes/<int:cliente_id>", methods=["DELETE"])
def excluir_cliente(cliente_id):

    conexao = conectar_banco()

    resultado = conexao.execute(
        "DELETE FROM clientes WHERE id = ?", (cliente_id,)
    )

    # As vendas do cliente continuam existindo, só perdem o vínculo
    if resultado.rowcount > 0:
        conexao.execute(
            "UPDATE vendas SET cliente_id = NULL WHERE cliente_id = ?",
            (cliente_id,)
        )

    conexao.commit()
    conexao.close()

    if resultado.rowcount == 0:
        return jsonify({"erro": "Cliente não encontrado."}), 404

    return jsonify({"mensagem": "Cliente excluído com sucesso!"})


if __name__ == "__main__":
    criar_banco()
    app.run(debug=True)
