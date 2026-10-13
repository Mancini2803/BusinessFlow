// Código compartilhado por todas as páginas:
// formatação de moeda, aviso (toast) e o modal de "Nova venda".

function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// "2026-10-13 17:25:00" -> "13/10/2026 17:25"
function formatarData(texto) {
    if (!texto) return "—";

    const [data, hora] = texto.split(" ");
    const [ano, mes, dia] = data.split("-");

    return `${dia}/${mes}/${ano}` + (hora ? ` ${hora.slice(0, 5)}` : "");
}

function mostrarAviso(texto, erro = false) {
    const aviso = document.createElement("div");
    aviso.className = "toast" + (erro ? " toast-erro" : "");
    aviso.textContent = texto;
    document.body.appendChild(aviso);

    setTimeout(() => aviso.remove(), 3000);
}


// ================= MODAL DE NOVA VENDA =================

const modal = document.getElementById("modalVenda");
const abrirModal = document.getElementById("abrirModal");
const fecharModal = document.getElementById("fecharModal");
const formulario = document.getElementById("formVenda");

// Produtos cadastrados, usados como sugestão no campo "Produto"
let produtosCadastrados = [];

async function carregarSugestoes() {
    try {
        const resposta = await fetch("/api/produtos");
        if (!resposta.ok) return;

        produtosCadastrados = await resposta.json();

        const lista = document.getElementById("listaProdutos");
        lista.innerHTML = "";

        produtosCadastrados.forEach((produto) => {
            const opcao = document.createElement("option");
            opcao.value = produto.nome;
            lista.appendChild(opcao);
        });
    } catch (erro) {
        console.error(erro);
    }
}

// Clientes cadastrados, para o campo "Cliente" da venda
async function carregarClientesVenda() {
    try {
        const resposta = await fetch("/api/clientes");
        if (!resposta.ok) return;

        const clientes = await resposta.json();
        const select = document.getElementById("clienteVenda");
        const escolhido = select.value;

        // Mantém só a primeira opção ("Sem cliente") e recria o resto
        select.length = 1;

        clientes.forEach((cliente) => {
            const opcao = document.createElement("option");
            opcao.value = cliente.id;
            opcao.textContent = cliente.nome;
            select.appendChild(opcao);
        });

        select.value = escolhido;
    } catch (erro) {
        console.error(erro);
    }
}

// Ao escolher um produto cadastrado, preenche o valor com o preço dele
document.getElementById("produto").addEventListener("input", (event) => {
    const nome = event.target.value.trim().toLowerCase();
    const produto = produtosCadastrados.find(
        (p) => p.nome.toLowerCase() === nome
    );

    const campoValor = document.getElementById("valor");

    if (produto && !campoValor.value) {
        campoValor.value = produto.preco;
    }
});

abrirModal.addEventListener("click", () => {
    modal.style.display = "flex";
    carregarSugestoes();
    carregarClientesVenda();
    document.getElementById("produto").focus();
});

fecharModal.addEventListener("click", () => {
    modal.style.display = "none";
});

// Fecha ao clicar fora da caixa ou apertar Esc
modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.style.display = "none";
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") modal.style.display = "none";
});


// ================= REGISTRAR VENDA =================

formulario.addEventListener("submit", async (event) => {

    event.preventDefault();

    const produto = document.getElementById("produto").value.trim();
    const valor = Number(document.getElementById("valor").value);
    const quantidade = Number(document.getElementById("quantidade").value);

    if (!produto || !(valor > 0) || !Number.isInteger(quantidade) || quantidade <= 0) {
        mostrarAviso("Preencha produto, valor e quantidade (inteira) corretamente.", true);
        return;
    }

    try {
        const resposta = await fetch("/api/vendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                produto,
                valor,
                quantidade,
                cliente_id: document.getElementById("clienteVenda").value
                    ? Number(document.getElementById("clienteVenda").value)
                    : null
            })
        });

        if (!resposta.ok) {
            throw new Error(`Erro ${resposta.status}`);
        }

        modal.style.display = "none";
        formulario.reset();

        // Cada página escuta este evento e recarrega seus dados
        document.dispatchEvent(new CustomEvent("venda:criada"));

        mostrarAviso(`Venda de ${produto} registrada com sucesso!`);

    } catch (erro) {
        console.error(erro);
        mostrarAviso("Não foi possível registrar a venda. Tente novamente.", true);
    }
});
