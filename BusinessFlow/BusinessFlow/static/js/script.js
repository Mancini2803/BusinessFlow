// ================= UTILITÁRIOS =================

const NOMES_MESES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

// Chave "AAAA-MM" de uma data
function chaveMes(ano, mes) {
    return `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

// Últimos N meses (do mais antigo ao atual)
function ultimosMeses(quantidade) {
    const hoje = new Date();
    const meses = [];

    for (let i = quantidade - 1; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        meses.push({
            chave: chaveMes(d.getFullYear(), d.getMonth()),
            nome: NOMES_MESES[d.getMonth()]
        });
    }

    return meses;
}

// Variação percentual entre dois valores (null se não der para calcular)
function variacao(atual, anterior) {
    if (!anterior) return null;
    return ((atual - anterior) / anterior) * 100;
}


// ================= CÁLCULO DOS INDICADORES =================

function calcularIndicadores(vendas) {

    let faturamento = 0;
    const porProduto = {};
    const porMes = {};

    vendas.forEach((venda) => {

        const total = venda.valor * venda.quantidade;
        faturamento += total;

        // Agrupa por produto
        if (!porProduto[venda.produto]) {
            porProduto[venda.produto] = {
                nome: venda.produto,
                unidades: 0,
                faturamento: 0
            };
        }
        porProduto[venda.produto].unidades += venda.quantidade;
        porProduto[venda.produto].faturamento += total;

        // Agrupa por mês (vendas antigas sem data ficam de fora)
        if (venda.data) {
            const chave = venda.data.slice(0, 7);
            if (!porMes[chave]) {
                porMes[chave] = { faturamento: 0, vendas: 0 };
            }
            porMes[chave].faturamento += total;
            porMes[chave].vendas += 1;
        }
    });

    const ranking = Object.values(porProduto).sort((a, b) =>
        b.unidades - a.unidades || b.faturamento - a.faturamento
    );

    const meses = ultimosMeses(6).map((mes) => ({
        nome: mes.nome,
        faturamento: porMes[mes.chave] ? porMes[mes.chave].faturamento : 0
    }));

    const mesAtual = ultimosMeses(2)[1].chave;
    const mesAnterior = ultimosMeses(2)[0].chave;
    const atual = porMes[mesAtual] || { faturamento: 0, vendas: 0 };
    const anterior = porMes[mesAnterior] || { faturamento: 0, vendas: 0 };

    return {
        faturamento,
        totalVendas: vendas.length,
        ranking,
        meses,
        crescimentoFaturamento: variacao(atual.faturamento, anterior.faturamento),
        crescimentoVendas: variacao(atual.vendas, anterior.vendas)
    };
}


// ================= ATUALIZAÇÃO DA TELA =================

function mostrarCrescimento(elemento, valor) {
    if (valor === null) {
        elemento.textContent = "—";
        elemento.style.color = "";
        return;
    }

    const seta = valor >= 0 ? "↑" : "↓";
    elemento.textContent =
        `${seta} ${Math.abs(valor).toFixed(1).replace(".", ",")}%`;
    elemento.style.color = valor >= 0 ? "" : "#dc2626";
}

function atualizarCards(info) {
    document.querySelector(".card:nth-child(1) h2").textContent =
        formatarMoeda(info.faturamento);

    document.querySelector(".card:nth-child(2) h2").textContent =
        info.totalVendas;

    document.querySelector(".card:nth-child(3) h2").textContent =
        info.totalClientes;

    mostrarCrescimento(
        document.querySelector(".card:nth-child(1) .positive"),
        info.crescimentoFaturamento
    );
    mostrarCrescimento(
        document.querySelector(".card:nth-child(2) .positive"),
        info.crescimentoVendas
    );
    mostrarCrescimento(
        document.querySelector(".card:nth-child(3) .positive"),
        info.crescimentoClientes
    );
}

function atualizarGrafico(meses) {
    const barras = document.querySelectorAll(".bar");
    const labels = document.querySelectorAll(".bar-container span");
    const maior = Math.max(...meses.map((m) => m.faturamento));

    barras.forEach((barra, i) => {
        const mes = meses[i];
        const porcentagem = maior > 0 ? (mes.faturamento / maior) * 100 : 0;

        barra.style.height = `${Math.max(porcentagem, 2)}%`;
        barra.title = formatarMoeda(mes.faturamento);
        labels[i].textContent = mes.nome;
    });
}

function atualizarProdutos(ranking) {
    const lista = document.querySelector(".products");
    lista.innerHTML = "";

    if (ranking.length === 0) {
        const vazio = document.createElement("p");
        vazio.textContent = "Nenhuma venda cadastrada ainda.";
        lista.appendChild(vazio);
        return;
    }

    // textContent (e não innerHTML) porque o nome do produto vem do usuário
    ranking.slice(0, 3).forEach((produto, i) => {
        const item = document.createElement("div");
        item.className = "product";

        const numero = document.createElement("div");
        numero.className = "product-number";
        numero.textContent = i + 1;

        const info = document.createElement("div");
        info.className = "product-info";

        const nome = document.createElement("strong");
        nome.textContent = produto.nome;

        const unidades = document.createElement("span");
        unidades.textContent =
            `${produto.unidades} ${produto.unidades === 1 ? "unidade" : "unidades"}`;

        info.append(nome, unidades);

        const total = document.createElement("strong");
        total.textContent = formatarMoeda(produto.faturamento);

        item.append(numero, info, total);
        lista.appendChild(item);
    });
}


// ================= INTEGRAÇÃO COM A API =================

// Total de clientes e crescimento da base em relação ao fim do mês passado
function calcularClientes(clientes) {
    const mesAtual = ultimosMeses(1)[0].chave;   // "AAAA-MM"

    const ateMesPassado = clientes.filter(
        (c) => c.criado_em && c.criado_em.slice(0, 7) < mesAtual
    ).length;

    return {
        totalClientes: clientes.length,
        crescimentoClientes: variacao(clientes.length, ateMesPassado)
    };
}

async function carregarDashboard() {
    try {
        const [respVendas, respClientes] = await Promise.all([
            fetch("/api/vendas"),
            fetch("/api/clientes")
        ]);

        if (!respVendas.ok) {
            throw new Error(`Erro ${respVendas.status}`);
        }

        const vendas = await respVendas.json();
        const clientes = respClientes.ok ? await respClientes.json() : [];

        const info = {
            ...calcularIndicadores(vendas),
            ...calcularClientes(clientes)
        };

        atualizarCards(info);
        atualizarGrafico(info.meses);
        atualizarProdutos(info.ranking);

    } catch (erro) {
        console.error("Não foi possível carregar o dashboard:", erro);
    }
}


// ================= EVENTOS =================

// common.js avisa quando uma nova venda é cadastrada
document.addEventListener("venda:criada", carregarDashboard);

carregarDashboard();
