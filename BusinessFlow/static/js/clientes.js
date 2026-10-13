// Página de Clientes: listar, cadastrar, editar, excluir e ver histórico de compras

const tabelaClientes = document.getElementById("listaClientes");
const resumoClientes = document.getElementById("resumoClientes");
const buscaCliente = document.getElementById("buscaCliente");

const modalCliente = document.getElementById("modalCliente");
const formCliente = document.getElementById("formCliente");
const tituloModalCliente = document.getElementById("tituloModalCliente");

const modalHistorico = document.getElementById("modalHistorico");
const tituloHistorico = document.getElementById("tituloHistorico");
const listaHistorico = document.getElementById("listaHistorico");

let clientes = [];
let vendas = [];
let clienteEmEdicao = null;   // null = cadastrando um novo


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

function criarContato(cliente) {
    const caixa = document.createElement("div");
    caixa.className = "contato";

    if (!cliente.email && !cliente.telefone) {
        caixa.textContent = "—";
        return caixa;
    }

    [cliente.email, cliente.telefone].filter(Boolean).forEach((texto) => {
        const linha = document.createElement("div");
        linha.textContent = texto;
        caixa.appendChild(linha);
    });

    return caixa;
}

function criarBotao(texto, classe, aoClicar) {
    const botao = document.createElement("button");
    botao.className = classe;
    botao.textContent = texto;
    botao.addEventListener("click", aoClicar);
    return botao;
}

function renderizar() {
    const filtro = buscaCliente.value.trim().toLowerCase();

    const lista = clientes.filter((c) =>
        c.nome.toLowerCase().includes(filtro) ||
        (c.email || "").toLowerCase().includes(filtro)
    );

    tabelaClientes.innerHTML = "";

    if (lista.length === 0) {
        const tr = document.createElement("tr");
        const td = criarCelula(
            clientes.length === 0
                ? "Nenhum cliente cadastrado ainda. Clique em “+ Novo cliente”."
                : "Nenhum cliente encontrado para essa busca.",
            "vazio"
        );
        td.colSpan = 5;
        tr.appendChild(td);
        tabelaClientes.appendChild(tr);
    }

    let somaGasto = 0;

    // textContent em tudo: nome, e-mail e telefone vêm do usuário
    lista.forEach((cliente) => {
        somaGasto += cliente.total_gasto;

        const tr = document.createElement("tr");

        tr.appendChild(criarCelula(cliente.nome));
        tr.appendChild(criarCelula(criarContato(cliente)));
        tr.appendChild(criarCelula(cliente.compras, "num"));
        tr.appendChild(criarCelula(formatarMoeda(cliente.total_gasto), "num total"));

        const acoes = document.createElement("td");
        acoes.className = "acoes";
        acoes.append(
            criarBotao("Compras", "btn-editar", () => abrirHistorico(cliente)),
            criarBotao("Editar", "btn-editar", () => abrirFormulario(cliente)),
            criarBotao("Excluir", "btn-excluir", () => excluirCliente(cliente))
        );

        tr.appendChild(acoes);
        tabelaClientes.appendChild(tr);
    });

    const n = lista.length;
    resumoClientes.textContent =
        `${n} ${n === 1 ? "cliente" : "clientes"} · ${formatarMoeda(somaGasto)} em compras`;
}


// ================= CARREGAR DADOS =================

async function carregarClientes() {
    try {
        const [respClientes, respVendas] = await Promise.all([
            fetch("/api/clientes"),
            fetch("/api/vendas")
        ]);

        if (!respClientes.ok || !respVendas.ok) {
            throw new Error("Falha ao carregar dados");
        }

        clientes = await respClientes.json();
        vendas = await respVendas.json();

        renderizar();

    } catch (erro) {
        console.error(erro);
        resumoClientes.textContent = "Não foi possível carregar os clientes.";
    }
}


// ================= HISTÓRICO DE COMPRAS =================

function abrirHistorico(cliente) {
    tituloHistorico.textContent = `Compras de ${cliente.nome}`;
    listaHistorico.innerHTML = "";

    const compras = vendas
        .filter((v) => v.cliente_id === cliente.id)
        .sort((a, b) => b.id - a.id);

    if (compras.length === 0) {
        const tr = document.createElement("tr");
        const td = criarCelula("Este cliente ainda não tem compras.", "vazio");
        td.colSpan = 4;
        tr.appendChild(td);
        listaHistorico.appendChild(tr);
    }

    compras.forEach((venda) => {
        const tr = document.createElement("tr");
        tr.appendChild(criarCelula(formatarData(venda.data)));
        tr.appendChild(criarCelula(venda.produto));
        tr.appendChild(criarCelula(venda.quantidade, "num"));
        tr.appendChild(criarCelula(formatarMoeda(venda.valor * venda.quantidade), "num total"));
        listaHistorico.appendChild(tr);
    });

    modalHistorico.style.display = "flex";
}

function fecharHistorico() {
    modalHistorico.style.display = "none";
}

document.getElementById("fecharHistorico").addEventListener("click", fecharHistorico);

modalHistorico.addEventListener("click", (event) => {
    if (event.target === modalHistorico) fecharHistorico();
});


// ================= FORMULÁRIO (CADASTRAR / EDITAR) =================

function abrirFormulario(cliente = null) {
    clienteEmEdicao = cliente;

    tituloModalCliente.textContent = cliente ? "Editar cliente" : "Novo cliente";

    document.getElementById("nomeCliente").value = cliente ? cliente.nome : "";
    document.getElementById("emailCliente").value = cliente ? (cliente.email || "") : "";
    document.getElementById("telefoneCliente").value = cliente ? (cliente.telefone || "") : "";

    modalCliente.style.display = "flex";
    document.getElementById("nomeCliente").focus();
}

function fecharFormulario() {
    modalCliente.style.display = "none";
    formCliente.reset();
    clienteEmEdicao = null;
}

document.getElementById("novoCliente").addEventListener("click", () => abrirFormulario());
document.getElementById("fecharModalCliente").addEventListener("click", fecharFormulario);

modalCliente.addEventListener("click", (event) => {
    if (event.target === modalCliente) fecharFormulario();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        fecharFormulario();
        fecharHistorico();
    }
});

formCliente.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = document.getElementById("nomeCliente").value.trim();
    const email = document.getElementById("emailCliente").value.trim();
    const telefone = document.getElementById("telefoneCliente").value.trim();

    if (!nome) {
        mostrarAviso("Informe o nome do cliente.", true);
        return;
    }

    const editando = clienteEmEdicao !== null;
    const url = editando ? `/api/clientes/${clienteEmEdicao.id}` : "/api/clientes";

    try {
        const resposta = await fetch(url, {
            method: editando ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, telefone })
        });

        if (!resposta.ok) {
            const corpo = await resposta.json().catch(() => ({}));
            mostrarAviso(corpo.erro || "Não foi possível salvar o cliente.", true);
            return;
        }

        fecharFormulario();
        mostrarAviso(editando ? "Cliente atualizado." : `Cliente ${nome} cadastrado.`);
        await carregarClientes();

    } catch (erro) {
        console.error(erro);
        mostrarAviso("Não foi possível salvar o cliente.", true);
    }
});


// ================= EXCLUIR =================

async function excluirCliente(cliente) {
    if (!confirm(`Excluir o cliente "${cliente.nome}"? As vendas dele continuam registradas, só deixam de ter cliente.`)) return;

    try {
        const resposta = await fetch(`/api/clientes/${cliente.id}`, {
            method: "DELETE"
        });

        if (!resposta.ok) {
            throw new Error(`Erro ${resposta.status}`);
        }

        mostrarAviso("Cliente excluído.");
        await carregarClientes();

    } catch (erro) {
        console.error(erro);
        mostrarAviso("Não foi possível excluir o cliente.", true);
    }
}


buscaCliente.addEventListener("input", renderizar);
document.addEventListener("venda:criada", carregarClientes);

carregarClientes();
