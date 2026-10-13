// Página de Vendas: lista, busca e exclusão

const tabela = document.getElementById("listaVendas");
const resumo = document.getElementById("resumoVendas");
const busca = document.getElementById("busca");

let todasVendas = [];

function criarCelula(texto, classe) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
}

function renderizar() {
    const filtro = busca.value.trim().toLowerCase();

    const vendas = todasVendas.filter((v) =>
        v.produto.toLowerCase().includes(filtro) ||
        (v.cliente_nome || "").toLowerCase().includes(filtro)
    );

    tabela.innerHTML = "";

    if (vendas.length === 0) {
        const tr = document.createElement("tr");
        const td = criarCelula(
            todasVendas.length === 0
                ? "Nenhuma venda cadastrada ainda."
                : "Nenhuma venda encontrada para essa busca.",
            "vazio"
        );
        td.colSpan = 7;
        tr.appendChild(td);
        tabela.appendChild(tr);
    }

    let soma = 0;

    // textContent em tudo: o nome do produto vem do usuário
    vendas.forEach((venda) => {
        const total = venda.valor * venda.quantidade;
        soma += total;

        const tr = document.createElement("tr");

        tr.appendChild(criarCelula(formatarData(venda.data)));
        tr.appendChild(criarCelula(venda.produto));
        tr.appendChild(criarCelula(venda.cliente_nome || "—"));
        tr.appendChild(criarCelula(formatarMoeda(venda.valor), "num"));
        tr.appendChild(criarCelula(venda.quantidade, "num"));
        tr.appendChild(criarCelula(formatarMoeda(total), "num total"));

        const acoes = document.createElement("td");
        acoes.className = "acoes";

        const botao = document.createElement("button");
        botao.className = "btn-excluir";
        botao.textContent = "Excluir";
        botao.addEventListener("click", () => excluirVenda(venda));

        acoes.appendChild(botao);
        tr.appendChild(acoes);
        tabela.appendChild(tr);
    });

    const n = vendas.length;
    resumo.textContent =
        `${n} ${n === 1 ? "venda" : "vendas"} · ${formatarMoeda(soma)}`;
}

async function carregarVendas() {
    try {
        const resposta = await fetch("/api/vendas");

        if (!resposta.ok) {
            throw new Error(`Erro ${resposta.status}`);
        }

        const vendas = await resposta.json();

        // Mais recentes primeiro
        todasVendas = vendas.sort((a, b) => b.id - a.id);
        renderizar();

    } catch (erro) {
        console.error(erro);
        resumo.textContent = "Não foi possível carregar as vendas.";
    }
}

async function excluirVenda(venda) {
    if (!confirm(`Excluir a venda de "${venda.produto}"?`)) return;

    try {
        const resposta = await fetch(`/api/vendas/${venda.id}`, {
            method: "DELETE"
        });

        if (!resposta.ok) {
            throw new Error(`Erro ${resposta.status}`);
        }

        mostrarAviso("Venda excluída.");
        await carregarVendas();

    } catch (erro) {
        console.error(erro);
        mostrarAviso("Não foi possível excluir a venda.", true);
    }
}

busca.addEventListener("input", renderizar);
document.addEventListener("venda:criada", carregarVendas);

carregarVendas();
