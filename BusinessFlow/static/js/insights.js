// Painel "Análise inteligente" do Dashboard.
// Mostra insights por regras (sempre) e, se houver chave, a análise do Gemini.

const listaInsights = document.getElementById("listaInsights");
const btnGerarIA = document.getElementById("btnGerarIA");
const iaNota = document.getElementById("iaNota");
const iaSubtitulo = document.getElementById("iaSubtitulo");

const ICONES = { positivo: "▲", alerta: "!", info: "i" };

let estado = null;

function desenharInsights(itens) {
    listaInsights.textContent = "";

    if (!itens.length) {
        const vazio = document.createElement("li");
        vazio.className = "insight info";
        vazio.textContent = "Ainda não há dados suficientes para uma análise.";
        listaInsights.appendChild(vazio);
        return;
    }

    itens.forEach(item => {
        const tipo = ICONES[item.tipo] ? item.tipo : "info";

        const li = document.createElement("li");
        li.className = "insight " + tipo;

        const icone = document.createElement("span");
        icone.className = "insight-icone";
        icone.setAttribute("aria-hidden", "true");
        icone.textContent = ICONES[tipo];

        const texto = document.createElement("p");
        texto.textContent = item.texto;            // textContent: nunca innerHTML

        li.append(icone, texto);
        listaInsights.appendChild(li);
    });
}

function formatarQuando(texto) {
    const [dia, hora] = texto.split(" ");
    const [a, m, d] = dia.split("-");
    return `${d}/${m}/${a} às ${hora.slice(0, 5)}`;
}

function desenharPainel() {
    const e = estado;
    btnGerarIA.hidden = !e.ia_configurada;

    if (e.ia) {
        desenharInsights(e.ia.insights);
        iaSubtitulo.textContent = "Análise escrita pelo Gemini";
        iaNota.textContent = "Gerada em " + formatarQuando(e.ia.criado_em) +
            (e.ia_desatualizada ? " · seus dados mudaram desde então, gere de novo para atualizar." : ".");
        btnGerarIA.textContent = "✨ Atualizar análise";
    } else {
        desenharInsights(e.regras);
        iaSubtitulo.textContent = "Resumo automático do seu negócio";
        iaNota.textContent = e.ia_configurada
            ? "Clique em “Gerar análise com IA” para o Gemini escrever uma análise mais completa."
            : "Para ativar a análise com IA, coloque sua chave do Gemini no arquivo .env (veja o README).";
        btnGerarIA.textContent = "✨ Gerar análise com IA";
    }
}

async function carregarInsights() {
    try {
        const resposta = await fetch("/api/insights");
        if (!resposta.ok) throw new Error();
        estado = await resposta.json();
        desenharPainel();
    } catch (erro) {
        listaInsights.textContent = "";
        iaNota.textContent = "Não foi possível carregar a análise agora.";
    }
}

async function gerarAnaliseIA() {
    btnGerarIA.disabled = true;
    btnGerarIA.textContent = "Analisando…";

    try {
        const resposta = await fetch("/api/insights/gerar", { method: "POST" });
        const dados = await resposta.json();

        if (!resposta.ok) {
            mostrarAviso(dados.erro || "Não foi possível gerar a análise.", true);
        } else {
            await carregarInsights();
            mostrarAviso("Análise atualizada!");
        }
    } catch (erro) {
        mostrarAviso("Erro de conexão com o servidor.", true);
    }

    btnGerarIA.disabled = false;
    if (estado) desenharPainel();
}

btnGerarIA.addEventListener("click", gerarAnaliseIA);
document.addEventListener("venda:criada", carregarInsights);

carregarInsights();
