// Página de Relatórios: período, indicadores, gráficos e rankings
// Tudo é calculado no navegador a partir de /api/vendas.

const NOMES_MESES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

// Cores do sistema (mesmas do restante do BusinessFlow)
const COR_SERIE = "#4f46e5";
const COR_TINTA = "#1e293b";
const COR_MUDO = "#64748b";
const COR_GRADE = "#e2e8f0";

const moedaCompacta = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1
});

let vendas = [];       // somente vendas que têm data
let semData = 0;       // vendas antigas, sem data
let graficoEvolucao = null;
let graficoProdutos = null;


// ================= DATAS (sempre texto "AAAA-MM-DD", sem fuso) =================

const doisDigitos = (n) => String(n).padStart(2, "0");

function iso(data) {
    return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

function lerIso(texto) {
    const [a, m, d] = texto.split("-").map(Number);
    return new Date(a, m - 1, d);
}

function somarDias(texto, dias) {
    const data = lerIso(texto);
    data.setDate(data.getDate() + dias);
    return iso(data);
}

// Quantidade de dias entre duas datas, contando as duas pontas
function diasEntre(inicio, fim) {
    const [a1, m1, d1] = inicio.split("-").map(Number);
    const [a2, m2, d2] = fim.split("-").map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000) + 1;
}

function diasNoMes(ano, mes0) {
    return new Date(ano, mes0 + 1, 0).getDate();
}

// Mesmo dia do mês (ou o último dia, se o mês for mais curto)
function mesmoDiaEm(ano, mes0, dia) {
    return iso(new Date(ano, mes0, Math.min(dia, diasNoMes(ano, mes0))));
}

function dataCurta(texto) {
    const [a, m, d] = texto.split("-");
    return `${d}/${m}/${a}`;
}


// ================= PERÍODOS =================

function calcularPeriodo(tipo) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const dia = hoje.getDate();

    let inicio;
    let fim = iso(hoje);
    let anterior = null;

    // Janela do mesmo tamanho, logo antes do início
    const janelaAnterior = () => {
        const n = diasEntre(inicio, fim);
        const anteriorFim = somarDias(inicio, -1);
        return { inicio: somarDias(anteriorFim, -(n - 1)), fim: anteriorFim };
    };

    switch (tipo) {
        case "mes":
            inicio = iso(new Date(ano, mes, 1));
            anterior = {
                inicio: iso(new Date(ano, mes - 1, 1)),
                fim: mesmoDiaEm(ano, mes - 1, dia)
            };
            break;

        case "30d":
            inicio = somarDias(fim, -29);
            anterior = janelaAnterior();
            break;

        case "3m":
            inicio = iso(new Date(ano, mes - 2, 1));
            anterior = janelaAnterior();
            break;

        case "6m":
            inicio = iso(new Date(ano, mes - 5, 1));
            anterior = janelaAnterior();
            break;

        case "ano":
            inicio = `${ano}-01-01`;
            anterior = {
                inicio: `${ano - 1}-01-01`,
                fim: mesmoDiaEm(ano - 1, mes, dia)
            };
            break;

        case "tudo": {
            const datas = vendas.map((v) => v.data.slice(0, 10)).sort();
            inicio = datas.length ? datas[0] : fim;
            break;
        }

        case "personalizado": {
            const de = document.getElementById("dataDe").value;
            const ate = document.getElementById("dataAte").value;
            if (!de || !ate || de > ate) return null;
            inicio = de;
            fim = ate;
            anterior = janelaAnterior();
            break;
        }
    }

    return { inicio, fim, anterior };
}


// ================= CÁLCULOS =================

function resumir(inicio, fim) {
    let faturamento = 0;
    let quantidade = 0;
    let unidades = 0;

    vendas.forEach((v) => {
        const dia = v.data.slice(0, 10);
        if (dia < inicio || dia > fim) return;

        faturamento += v.valor * v.quantidade;
        unidades += v.quantidade;
        quantidade += 1;
    });

    return {
        faturamento,
        vendas: quantidade,
        unidades,
        ticket: quantidade > 0 ? faturamento / quantidade : 0
    };
}

// Variação percentual (null quando não dá para comparar)
function variacao(atual, anterior) {
    if (!anterior) return null;
    return ((atual - anterior) / anterior) * 100;
}

function serieEvolucao(inicio, fim) {
    const diario = diasEntre(inicio, fim) <= 62;
    const soma = {};

    vendas.forEach((v) => {
        const dia = v.data.slice(0, 10);
        if (dia < inicio || dia > fim) return;

        const chave = diario ? dia : dia.slice(0, 7);
        soma[chave] = (soma[chave] || 0) + v.valor * v.quantidade;
    });

    const rotulos = [];
    const valores = [];

    if (diario) {
        for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
            rotulos.push(`${d.slice(8)}/${d.slice(5, 7)}`);
            valores.push(soma[d] || 0);
        }
    } else {
        let [a, m] = inicio.split("-").map(Number);
        const [fa, fm] = fim.split("-").map(Number);

        while (a < fa || (a === fa && m <= fm)) {
            rotulos.push(`${NOMES_MESES[m - 1]}/${String(a).slice(2)}`);
            valores.push(soma[`${a}-${doisDigitos(m)}`] || 0);

            m += 1;
            if (m > 12) { m = 1; a += 1; }
        }
    }

    return { rotulos, valores, diario };
}

function rankingProdutos(inicio, fim) {
    const porProduto = {};

    vendas.forEach((v) => {
        const dia = v.data.slice(0, 10);
        if (dia < inicio || dia > fim) return;

        const chave = v.produto.trim().toLowerCase();
        if (!porProduto[chave]) {
            porProduto[chave] = { nome: v.produto.trim(), faturamento: 0 };
        }
        porProduto[chave].faturamento += v.valor * v.quantidade;
    });

    return Object.values(porProduto).sort((a, b) => b.faturamento - a.faturamento);
}

function rankingClientes(inicio, fim) {
    const porCliente = {};
    let semCliente = 0;

    vendas.forEach((v) => {
        const dia = v.data.slice(0, 10);
        if (dia < inicio || dia > fim) return;

        const total = v.valor * v.quantidade;

        if (v.cliente_id === null || v.cliente_id === undefined) {
            semCliente += total;
            return;
        }

        if (!porCliente[v.cliente_id]) {
            porCliente[v.cliente_id] = { nome: v.cliente_nome || "(cliente removido)", compras: 0, total: 0 };
        }
        porCliente[v.cliente_id].compras += 1;
        porCliente[v.cliente_id].total += total;
    });

    return {
        lista: Object.values(porCliente).sort((a, b) => b.total - a.total),
        semCliente
    };
}

// Últimos 12 meses (a partir do primeiro mês com venda), do mais recente ao mais antigo
function comparacaoMensal() {
    const porMes = {};

    vendas.forEach((v) => {
        const chave = v.data.slice(0, 7);
        if (!porMes[chave]) porMes[chave] = { faturamento: 0, vendas: 0 };
        porMes[chave].faturamento += v.valor * v.quantidade;
        porMes[chave].vendas += 1;
    });

    const hoje = new Date();
    const linhas = [];

    // Mês atual é parcial: compara só com o mesmo trecho (dia 1 até hoje) do mês anterior
    const mesmoTrechoAnterior = {};
    vendas.forEach((v) => {
        if (Number(v.data.slice(8, 10)) <= hoje.getDate()) {
            const chave = v.data.slice(0, 7);
            mesmoTrechoAnterior[chave] = (mesmoTrechoAnterior[chave] || 0) + v.valor * v.quantidade;
        }
    });

    for (let i = 0; i < 12; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const chave = `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}`;
        const anterior = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const chaveAnterior = `${anterior.getFullYear()}-${doisDigitos(anterior.getMonth() + 1)}`;

        const atual = porMes[chave] || { faturamento: 0, vendas: 0 };
        const antes = porMes[chaveAnterior];

        linhas.push({
            chave,
            rotulo: `${NOMES_MESES[d.getMonth()]}/${d.getFullYear()}`,
            parcial: i === 0,
            faturamento: atual.faturamento,
            vendas: atual.vendas,
            variacao: antes
                ? variacao(atual.faturamento, i === 0 ? (mesmoTrechoAnterior[chaveAnterior] || 0) : antes.faturamento)
                : null
        });
    }

    // Corta os meses anteriores à primeira venda
    const primeiro = Object.keys(porMes).sort()[0];
    return primeiro ? linhas.filter((l) => l.chave >= primeiro) : [];
}


// ================= TELA: INDICADORES =================

function textoVariacao(valor) {
    if (valor === null) return { texto: "—", classe: "" };
    if (Math.abs(valor) < 0.05) return { texto: "→ 0,0%", classe: "" };

    const seta = valor >= 0 ? "↑" : "↓";
    return {
        texto: `${seta} ${Math.abs(valor).toFixed(1).replace(".", ",")}%`,
        classe: valor >= 0 ? "sobe" : "desce"
    };
}

function preencherCard(id, valorTexto, atual, anterior, nomeAnterior) {
    const card = document.getElementById(id);
    card.querySelector("h2").textContent = valorTexto;

    const delta = card.querySelector(".delta");
    const nota = card.querySelector("small");

    if (anterior === undefined) {   // sem período anterior (ex.: "Todo o período")
        delta.textContent = "";
        delta.className = "delta";
        nota.textContent = "";
        return;
    }

    const v = textoVariacao(variacao(atual, anterior));
    delta.textContent = v.texto;
    delta.className = `delta ${v.classe}`;
    nota.textContent = nomeAnterior;
}

function atualizarIndicadores(periodo) {
    const atual = resumir(periodo.inicio, periodo.fim);
    const antes = periodo.anterior
        ? resumir(periodo.anterior.inicio, periodo.anterior.fim)
        : null;

    const nome = periodo.anterior
        ? `vs. ${dataCurta(periodo.anterior.inicio).slice(0, 5)} a ${dataCurta(periodo.anterior.fim).slice(0, 5)}`
        : "";

    const ref = (campo) => (antes ? antes[campo] : undefined);

    preencherCard("kpiFaturamento", formatarMoeda(atual.faturamento), atual.faturamento, ref("faturamento"), nome);
    preencherCard("kpiVendas", String(atual.vendas), atual.vendas, ref("vendas"), nome);
    preencherCard("kpiTicket", atual.vendas ? formatarMoeda(atual.ticket) : "—", atual.ticket, ref("ticket"), nome);
    preencherCard("kpiUnidades", String(atual.unidades), atual.unidades, ref("unidades"), nome);

    return atual;
}


// ================= TELA: GRÁFICOS =================

Chart.defaults.font.family = "Arial, sans-serif";
Chart.defaults.color = COR_MUDO;

const estiloTooltip = {
    backgroundColor: "#111827",
    titleColor: "#ffffff",
    bodyColor: "#ffffff",
    padding: 10,
    cornerRadius: 8,
    displayColors: false
};

function desenharEvolucao(serie) {
    if (graficoEvolucao) graficoEvolucao.destroy();

    const poucosPontos = serie.valores.length <= 13;

    graficoEvolucao = new Chart(document.getElementById("graficoEvolucao"), {
        type: "line",
        data: {
            labels: serie.rotulos,
            datasets: [{
                label: "Faturamento",
                data: serie.valores,
                borderColor: COR_SERIE,
                borderWidth: 2,
                borderJoinStyle: "round",
                backgroundColor: "rgba(79, 70, 229, 0.10)",
                fill: true,
                tension: 0,
                pointRadius: poucosPontos ? 4 : 0,
                pointHoverRadius: 5,
                pointBackgroundColor: COR_SERIE,
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },   // uma única série: o título já diz o que é
                tooltip: {
                    ...estiloTooltip,
                    callbacks: {
                        label: (item) => `Faturamento: ${formatarMoeda(item.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { color: COR_GRADE },
                    ticks: { maxTicksLimit: 10, maxRotation: 0 }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: COR_GRADE, lineWidth: 1 },
                    border: { display: false },
                    ticks: { callback: (v) => moedaCompacta.format(v) }
                }
            }
        }
    });
}

// Escreve o valor na ponta de cada barra
const valorNaPonta = {
    id: "valorNaPonta",
    afterDatasetsDraw(grafico) {
        const { ctx } = grafico;
        const dados = grafico.data.datasets[0].data;

        ctx.save();
        ctx.font = "12px Arial";
        ctx.fillStyle = COR_TINTA;
        ctx.textBaseline = "middle";

        grafico.getDatasetMeta(0).data.forEach((barra, i) => {
            ctx.fillText(formatarMoeda(dados[i]), barra.x + 8, barra.y);
        });

        ctx.restore();
    }
};

function cortar(texto, limite) {
    return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}

function desenharProdutos(ranking) {
    if (graficoProdutos) graficoProdutos.destroy();

    const top = ranking.slice(0, 5);

    graficoProdutos = new Chart(document.getElementById("graficoProdutos"), {
        type: "bar",
        data: {
            labels: top.map((p) => p.nome),
            datasets: [{
                label: "Faturamento",
                data: top.map((p) => p.faturamento),
                backgroundColor: COR_SERIE,
                maxBarThickness: 24,
                borderSkipped: false,
                borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 4, bottomRight: 4 }
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 96 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...estiloTooltip,
                    callbacks: {
                        label: (item) => `Faturamento: ${formatarMoeda(item.parsed.x)}`
                    }
                }
            },
            scales: {
                x: { display: false, beginAtZero: true, grid: { display: false } },
                y: {
                    grid: { display: false },
                    border: { color: COR_GRADE },
                    ticks: {
                        color: COR_TINTA,
                        callback(valor) { return cortar(this.getLabelForValue(valor), 18); }
                    }
                }
            }
        },
        plugins: [valorNaPonta]
    });
}


// ================= TELA: TABELAS =================

function criarCelula(texto, classe) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
}

function linhaVazia(corpo, colunas, texto) {
    const tr = document.createElement("tr");
    const td = criarCelula(texto, "vazio");
    td.colSpan = colunas;
    tr.appendChild(td);
    corpo.appendChild(tr);
}

function atualizarClientes(inicio, fim, faturamentoTotal) {
    const corpo = document.getElementById("listaTopClientes");
    const nota = document.getElementById("notaClientes");
    const { lista, semCliente } = rankingClientes(inicio, fim);

    corpo.innerHTML = "";

    if (lista.length === 0) {
        linhaVazia(corpo, 4, "Nenhuma venda com cliente neste período.");
    }

    // textContent: o nome do cliente vem do usuário
    lista.slice(0, 5).forEach((cliente) => {
        const parte = faturamentoTotal > 0 ? (cliente.total / faturamentoTotal) * 100 : 0;

        const tr = document.createElement("tr");
        tr.appendChild(criarCelula(cliente.nome));
        tr.appendChild(criarCelula(cliente.compras, "num"));
        tr.appendChild(criarCelula(formatarMoeda(cliente.total), "num total"));
        tr.appendChild(criarCelula(`${parte.toFixed(1).replace(".", ",")}%`, "num"));
        corpo.appendChild(tr);
    });

    nota.textContent = semCliente > 0
        ? `Vendas sem cliente informado: ${formatarMoeda(semCliente)}.`
        : "";
}

function atualizarMeses() {
    const corpo = document.getElementById("listaMeses");
    const linhas = comparacaoMensal();

    corpo.innerHTML = "";

    if (linhas.length === 0) {
        linhaVazia(corpo, 4, "Nenhuma venda com data registrada ainda.");
        return;
    }

    linhas.forEach((linha) => {
        const v = textoVariacao(linha.variacao);

        const tr = document.createElement("tr");
        tr.appendChild(criarCelula(linha.parcial ? `${linha.rotulo} (até hoje)` : linha.rotulo));
        tr.appendChild(criarCelula(formatarMoeda(linha.faturamento), "num total"));
        tr.appendChild(criarCelula(linha.vendas, "num"));
        tr.appendChild(criarCelula(v.texto, `num delta ${v.classe}`));
        corpo.appendChild(tr);
    });
}


// ================= ATUALIZAR A PÁGINA =================

function mostrarVazio(idCanvas, idMensagem, vazio) {
    document.getElementById(idCanvas).hidden = vazio;
    document.getElementById(idMensagem).hidden = !vazio;
}

function atualizar() {
    const tipo = document.getElementById("periodo").value;
    const periodo = calcularPeriodo(tipo);
    const info = document.getElementById("infoPeriodo");

    document.getElementById("filtroDatas").hidden = tipo !== "personalizado";

    if (!periodo) {
        info.textContent = "Escolha as duas datas (a primeira não pode ser depois da segunda).";
        return;
    }

    info.textContent = `${dataCurta(periodo.inicio)} a ${dataCurta(periodo.fim)}`;

    const atual = atualizarIndicadores(periodo);
    const vazio = atual.vendas === 0;

    // Evolução
    const serie = serieEvolucao(periodo.inicio, periodo.fim);
    document.getElementById("subtituloEvolucao").textContent =
        serie.diario ? "Faturamento por dia" : "Faturamento por mês";

    mostrarVazio("graficoEvolucao", "vazioEvolucao", vazio);
    if (vazio) {
        if (graficoEvolucao) { graficoEvolucao.destroy(); graficoEvolucao = null; }
    } else {
        desenharEvolucao(serie);
    }

    // Produtos
    const produtos = rankingProdutos(periodo.inicio, periodo.fim);
    document.getElementById("subtituloProdutos").textContent =
        produtos.length > 5
            ? `Mostrando os 5 que mais faturaram, de ${produtos.length} produtos`
            : "Produtos que mais faturaram";

    mostrarVazio("graficoProdutos", "vazioProdutos", vazio);
    if (vazio) {
        if (graficoProdutos) { graficoProdutos.destroy(); graficoProdutos = null; }
    } else {
        desenharProdutos(produtos);
    }

    atualizarClientes(periodo.inicio, periodo.fim, atual.faturamento);
    atualizarMeses();
}


// ================= CARREGAR DADOS =================

async function carregarVendas() {
    try {
        const resposta = await fetch("/api/vendas");

        if (!resposta.ok) {
            throw new Error(`Erro ${resposta.status}`);
        }

        const todas = await resposta.json();

        vendas = todas.filter((v) => v.data);
        semData = todas.length - vendas.length;

        const aviso = document.getElementById("avisoSemData");
        aviso.hidden = semData === 0;
        aviso.textContent = semData === 1
            ? "1 venda antiga, sem data registrada, não entra nos relatórios."
            : `${semData} vendas antigas, sem data registrada, não entram nos relatórios.`;

        atualizar();

    } catch (erro) {
        console.error(erro);
        document.getElementById("infoPeriodo").textContent =
            "Não foi possível carregar os dados.";
    }
}


// ================= EVENTOS =================

document.getElementById("periodo").addEventListener("change", (event) => {
    if (event.target.value === "personalizado") {
        const hoje = new Date();
        const de = document.getElementById("dataDe");
        const ate = document.getElementById("dataAte");

        if (!de.value) de.value = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
        if (!ate.value) ate.value = iso(hoje);
    }
    atualizar();
});

document.getElementById("dataDe").addEventListener("change", atualizar);
document.getElementById("dataAte").addEventListener("change", atualizar);
document.addEventListener("venda:criada", carregarVendas);

carregarVendas();
