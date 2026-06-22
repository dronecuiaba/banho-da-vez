// Lambda da skill Alexa "Banho da Vez".
// Lê o mesmo documento Firestore usado pelo app web e responde quem toma banho hoje.
// Runtime: Node.js 18.x ou superior (usa fetch nativo, sem dependências externas).

const FIRESTORE_URL =
  "https://firestore.googleapis.com/v1/projects/banho-da-vez/databases/(default)/documents/banho/state";

function todayISOBrasil() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // formato YYYY-MM-DD
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + "T00:00:00Z");
  const b = new Date(isoB + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

function parseFirestoreDoc(doc) {
  const fields = doc.fields || {};
  const children = (fields.children?.arrayValue?.values || []).map(v => ({
    id: v.mapValue.fields.id.stringValue,
    name: v.mapValue.fields.name.stringValue,
  }));
  const startDate = fields.startDate?.stringValue || null;
  const startChildId = fields.startChildId?.stringValue || null;
  return { children, startDate, startChildId };
}

function childForToday(state) {
  const { children, startDate, startChildId } = state;
  if (!children.length || !startDate) return null;
  const startIndex = children.findIndex(c => c.id === startChildId);
  const baseIndex = startIndex === -1 ? 0 : startIndex;
  const diff = daysBetween(startDate, todayISOBrasil());
  const len = children.length;
  const idx = ((baseIndex + diff) % len + len) % len;
  return children[idx];
}

async function getTodayChildName() {
  const resp = await fetch(FIRESTORE_URL);
  if (!resp.ok) throw new Error(`Firestore respondeu ${resp.status}`);
  const doc = await resp.json();
  if (!doc.fields) return null; // documento ainda não configurado
  const state = parseFirestoreDoc(doc);
  const child = childForToday(state);
  return child ? child.name : null;
}

function buildResponse(speechText, { endSession = true, repromptText = null } = {}) {
  const response = {
    outputSpeech: { type: "PlainText", text: speechText },
    shouldEndSession: endSession,
  };
  if (repromptText) {
    response.reprompt = { outputSpeech: { type: "PlainText", text: repromptText } };
  }
  return {
    version: "1.0",
    response,
  };
}

async function handleQuemTomaBanho() {
  try {
    const name = await getTodayChildName();
    if (!name) {
      return buildResponse(
        "Ainda não tem ninguém cadastrado na fila do banho. Cadastre as crianças no aplicativo primeiro."
      );
    }
    return buildResponse(`Hoje quem toma banho é ${name}.`);
  } catch (err) {
    console.error("Erro ao consultar Firestore:", err);
    return buildResponse(
      "Não consegui consultar a fila do banho agora. Tente novamente em instantes."
    );
  }
}

exports.handler = async event => {
  const requestType = event.request?.type;

  if (requestType === "LaunchRequest") {
    return handleQuemTomaBanho();
  }

  if (requestType === "IntentRequest") {
    const intentName = event.request.intent.name;

    if (intentName === "QuemTomaBanhoIntent") {
      return handleQuemTomaBanho();
    }

    if (intentName === "AMAZON.HelpIntent") {
      return buildResponse(
        "Você pode me perguntar: quem toma banho hoje? Eu respondo com o nome da criança da vez.",
        { endSession: false, repromptText: "Quer saber quem toma banho hoje?" }
      );
    }

    if (
      intentName === "AMAZON.CancelIntent" ||
      intentName === "AMAZON.StopIntent" ||
      intentName === "AMAZON.NavigateHomeIntent"
    ) {
      return buildResponse("Até mais!");
    }

    // AMAZON.FallbackIntent ou qualquer outro intent não tratado
    return buildResponse(
      "Não entendi. Pergunte: quem toma banho hoje?",
      { endSession: false, repromptText: "Quer saber quem toma banho hoje?" }
    );
  }

  if (requestType === "SessionEndedRequest") {
    return buildResponse("");
  }

  return buildResponse("Desculpe, não entendi o pedido.");
};
