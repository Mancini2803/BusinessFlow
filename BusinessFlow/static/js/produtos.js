// Página de Produtos: listar, cadastrar, editar e excluir

const tabelaProdutos = document.getElementById("listaProdutosTabela");
const resumoProdutos = document.getElementById("resumoProdutos");
const buscaProduto = document.getElementById("buscaProduto");

const modalProduto = document.getElementById("modalProduto");
const formProduto = document.getElementById("formProduto");
const tituloModalProduto = document.getElementById("tituloModalProduto");

let produtos = [];
let vendidosPorProduto = {};   // nome (minúsculo) -> unidades vendidas
let produtoEmEdicao = null;    // null = cadastrando um novo


// ================= RENDERIZAÇÃO =================

function criarCelula(conteudo, classe) {
    const td = document.createElement("td");
    if (conteudo instanceof Node) {
        td.appendChild(conteudo);
    } else {
        td.textContent = conteudo;
    }
    if (classe) td.className = classe;
    return td;
}

function criarEstoque(estoque) {
    if (estoque > 0) return String(estoque);

    const selo = document.createElement("span");
    selo.className = "selo-esgotado";
    selo.textContent = "Esgotado";
    return selo;
}

function renderizar() {
    const filtro = buscaProduto.value.trim().toLowerCase();

    const lista = produtos.filter((p) =>
        p.nome.toLowerCase().includes(filtro)
    );

    tabelaProdutos.innerHTML = "";

    if (lista.length === 0) {
        const tr = document.createElement("tr");
        const td = criarCelula(
            produtos.length === 0
                ? "Nenhum produto cadastrado ainda. Clique em “+ Novo produto”."
                : "Nenhum produto encontrado para essa busca.",
            "vazio"
        );
        td.colSpan = 5;
        tr.appendChild(td);
        tabelaProdutos.appendChild(tr);
    }

    let valorEmEstoque = 0;

    // textContent em tudo: o nome do produto vem do usuário
    lista.forEach((produto) => {
        valorEmEstoque += produto.preco * produto.estoque;

        const vendidos = vendidosPorProduto[produto.nome.toLowerCase()] || 0;

        const tr = document.createElement("tr");

        tr.appendChild(criarCelula(produto.nome));
        tr.appendChild(criarCelula(formatarMoeda(produto.preco), "num"));
        tr.appendChild(criarCelula(criarEstoque(produto.estoque), "num"));
        tr.appendChild(criarCelula(vendidos, "num"));

        const acoes = document.createElement("td");
        acoes.className = "acoes";

        const editar = document.createElement("button");
        editar.className = "btn-editar";
        editar.textContent = "Editar";
        editar.addEventListener("click", () => abrirFormulario(produto));

        const excluir = document.createElement("button");
        excluir.className = "btn-excluir";
        excluir.textContent = "Excluir";
        excluir.addEventListener("click", () => excluirProduto(produto));

        acoes.append(editar, excluir);
        tr.appendChild(acoes);
        tabelaProdutos.appendChild(tr);
    });

    const n = lista.length;
    resumoProdutos.textContent =
        `${n} ${n === 1 ? "produto" : "produtos"} · ${formatarMoeda(valorEmEstoque)} em estoque`;
}


// ================= CARREGAR DADOS =================

async function carregarProdutos() {
    try {
        const [respProdutos, respVendas] = await Promise.all([
            fetch("/api/produtos"),
            fetch("/api/vendas")
        ]);

        if (!respProdutos.ok || !respVendas.ok) {
            throw new Error("Falha ao carregar dados");
        }

        produtos = await respProdutos.json();
        const vendas = await respVendas.json();

        // Soma as unidades vendidas de cada produto (pelo nome)
        vendidosPorProduto = {};
        vendas.forEach((venda) => {
            const chave = venda.produto.trim().toLowerCase();
            vendidosPorProduto[chave] =
                (vendidosPorProduto[chave] || 0) + venda.quantidade;
        });

        renderizar();

    } catch (erro) {
        console.error(erro);
        resumoProdutos.textContent = "Não foi possível carregar os produtos.";
    }
}


// ================= FORMULÁRIO (CADASTRAR / EDITAR) =================

function abrirFormulario(produto = null) {
    produtoEmEdicao = produto;

    tituloModalProduto.textContent = produto ? "Editar produto" : "Novo produto";

    document.getElementById("nomeProduto").value = produto ? produto.nome : "";
    document.getElementById("precoProduto").value = produto ? produto.preco : "";
    document.getElementById("estoqueProduto").value = produto ? produto.estoque : "";

    modalProduto.style.display = "flex";
    document.getElementById("nomeProduto").focus();
}

function fecharFormulario() {
    modalProduto.style.display = "none";
    formProduto.reset();
    produtoEmEdicao = null;
}

document.getElementById("novoProduto").addEventListener("click", () => abrirFormulario());
document.getElementById("fecharModalProduto").addEventListener("click", fecharFormulario);

modalProduto.addEventListener("click", (event) => {
    if (event.target === modalProduto) fecharFormulario();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") fecharFormulario();
});

formProduto.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = document.getElementById("nomeProduto").value.trim();
    const preco = Number(document.getElementById("precoProduto").value);
    const estoque = Number(document.getElementById("estoqueProduto").value);

    if (!nome || !(preco > 0) || !Number.isInteger(estoque) || estoque < 0) {
        mostrarAviso("Preencha nome, preço e estoque (inteiro) corretamente.", true);
        return;
    }

    const editando = produtoEmEdicao !== null;
    const url = editando ? `/api/produtos/${produtoEmEdicao.id}` : "/api/produtos";

    try {
        const resposta = await fetch(url, {
            method: editando ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, preco, estoque })
        });

        if (!resposta.ok) {
            const corpo = await resposta.json().catch(() => ({}));
            mostrarAviso(corpo.erro || "Não foi possível salvar o produto.", true);
            return;
        }

        fecharFormulario();
        mostrarAviso(editando ? "Produto atualizado." : `Produto ${nome} cadastrado.`);
        await carregarProdutos();

    } catch (erro) {
        console.error(erro);
        mostrarAviso("Não foi possível salvar o produto.", true);
    }
});


// ================= EXCLUIR =================

async function excluirProduto(produto) {
    if (!confirm(`Excluir o produto "${produto.nome}"? As vendas já registradas não serão apagadas.`)) return;

    try {
        const resposta = await fetch(`/api/produtos/${produto.id}`, {
            method: "DELETE"
        });

        if (!resposta.ok) {
            throw new Error(`Erro ${resposta.status}`);
        }

        mostrarAviso("Produto excluído.");
        await carregarProdutos();

    } catch (erro) {
        console.error(erro);
        mostrarAviso("Não foi possível excluir o produto.", true);
    }
}


buscaProduto.addEventListener("input", renderizar);
document.addEventListener("venda:criada", carregarProdutos);

carregarProdutos();
