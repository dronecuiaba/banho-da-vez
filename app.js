// Estado persistido no Firestore (compartilhado entre dispositivos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAC7zRbVRcNN6fYQJ2Jgm85SsoEyYuDOcY",
  authDomain: "banho-da-vez.firebaseapp.com",
  projectId: "banho-da-vez",
  storageBucket: "banho-da-vez.firebasestorage.app",
  messagingSenderId: "361168414844",
  appId: "1:361168414844:web:ab28e3a157634d8b9e01f9",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const stateRef = doc(db, "banho", "state");

let state = { children: [], startDate: null, startChildId: null };

// view atual: "loading" | "children" | "start" | "dashboard" | "manage"
let view = "loading";
let hasLoadedOnce = false;
let syncError = false;

const app = document.getElementById("app");

render();

function persist() {
  setDoc(stateRef, state).catch(err => {
    console.error("Erro ao salvar no Firestore:", err);
    syncError = true;
    render();
  });
}

onSnapshot(
  stateRef,
  snap => {
    syncError = false;
    state = snap.exists()
      ? snap.data()
      : { children: [], startDate: null, startChildId: null };
    if (!hasLoadedOnce) {
      hasLoadedOnce = true;
      view = state.children.length === 0
        ? "children"
        : (!state.startDate ? "start" : "dashboard");
    }
    render();
  },
  err => {
    console.error("Erro ao sincronizar com Firestore:", err);
    syncError = true;
    if (!hasLoadedOnce) {
      hasLoadedOnce = true;
      view = "error";
    }
    render();
  }
);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function dateOnly(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function todayISO() {
  return dateOnly(new Date()).toISOString().slice(0, 10);
}

function daysBetween(isoA, isoB) {
  const a = dateOnly(isoA);
  const b = dateOnly(isoB);
  return Math.round((b - a) / 86400000);
}

function childForDate(iso) {
  const { children, startDate, startChildId } = state;
  if (children.length === 0 || !startDate) return null;
  const startIndex = children.findIndex(c => c.id === startChildId);
  const baseIndex = startIndex === -1 ? 0 : startIndex;
  const diff = daysBetween(startDate, iso);
  const len = children.length;
  const idx = ((baseIndex + diff) % len + len) % len;
  return children[idx];
}

function formatDateLabel(iso, todayIso) {
  const diff = daysBetween(todayIso, iso);
  const weekday = new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long" });
  const dayMonth = new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  let label = weekday;
  if (diff === 0) label = "Hoje";
  if (diff === 1) label = "Amanhã";
  return `${label} · ${dayMonth}`;
}

function addDaysISO(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function initials(name) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function render() {
  app.innerHTML = "";
  if (view === "loading") renderLoading();
  else if (view === "error") renderError();
  else if (view === "children") renderChildrenSetup();
  else if (view === "start") renderStartSetup();
  else if (view === "dashboard") renderDashboard();
  else if (view === "manage") renderManage();
}

function renderSyncBanner(wrap) {
  if (syncError) {
    wrap.appendChild(el("p", { class: "subtitle", text: "⚠️ Sem conexão com o servidor. Tentando reconectar..." }));
  }
}

function renderError() {
  const wrap = el("div");
  wrap.appendChild(el("h1", { text: "Banho da Vez" }));
  wrap.appendChild(el("p", { class: "subtitle", text: "⚠️ Não foi possível conectar ao servidor. Verifique sua internet ou tente novamente em instantes." }));
  const retryBtn = el("button", { class: "btn-primary", text: "Tentar novamente" });
  retryBtn.addEventListener("click", () => location.reload());
  wrap.appendChild(retryBtn);
  app.appendChild(wrap);
}

function renderLoading() {
  const wrap = el("div");
  wrap.appendChild(el("h1", { text: "Banho da Vez" }));
  wrap.appendChild(el("p", { class: "subtitle", text: "Carregando..." }));
  app.appendChild(wrap);
}

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text) node.textContent = opts.text;
  if (opts.html) node.innerHTML = opts.html;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.onclick) node.addEventListener("click", opts.onclick);
  for (const c of children) node.appendChild(c);
  return node;
}

// ---------- Tela 1: cadastro de crianças ----------
function renderChildrenSetup() {
  const wrap = el("div");
  wrap.appendChild(el("h1", { text: "Banho da Vez" }));
  wrap.appendChild(el("p", { class: "subtitle", text: "Cadastre as crianças que vão revezar o banho" }));

  const card = el("div", { class: "card" });

  if (state.children.length === 0) {
    card.appendChild(el("div", { class: "empty-state", text: "Nenhuma criança cadastrada ainda." }));
  } else {
    const list = el("div");
    state.children.forEach(child => {
      const row = el("div", { class: "child-row" });
      const nameWrap = el("div", { class: "name" }, [
        el("div", { class: "mini-avatar", text: initials(child.name) }),
        el("span", { text: child.name }),
      ]);
      const removeBtn = el("button", { class: "btn-danger", text: "Remover" });
      removeBtn.addEventListener("click", () => {
        state.children = state.children.filter(c => c.id !== child.id);
        if (state.startChildId === child.id) state.startChildId = null;
        persist();
        render();
      });
      row.appendChild(nameWrap);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
    card.appendChild(list);
  }

  const addRow = el("div", { class: "add-row" });
  const input = el("input", { attrs: { type: "text", placeholder: "Nome da criança" } });
  const addBtn = el("button", { class: "btn-primary", text: "Adicionar" });
  function addChild() {
    const name = input.value.trim();
    if (!name) return;
    state.children.push({ id: uid(), name });
    persist();
    input.value = "";
    render();
  }
  addBtn.addEventListener("click", addChild);
  input.addEventListener("keydown", e => { if (e.key === "Enter") addChild(); });
  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  card.appendChild(addRow);

  wrap.appendChild(card);

  const continueBtn = el("button", { class: "btn-primary", text: "Continuar" });
  continueBtn.disabled = state.children.length < 2;
  if (continueBtn.disabled) continueBtn.style.opacity = "0.5";
  continueBtn.addEventListener("click", () => {
    if (state.children.length < 2) return;
    view = "start";
    render();
  });
  wrap.appendChild(continueBtn);
  if (state.children.length < 2) {
    wrap.appendChild(el("p", { class: "subtitle", text: "Cadastre pelo menos 2 crianças para continuar." }));
  }

  app.appendChild(wrap);
}

// ---------- Tela 2: por quem começar a fila ----------
function renderStartSetup() {
  const wrap = el("div");
  wrap.appendChild(el("h1", { text: "Quem começa?" }));
  wrap.appendChild(el("p", { class: "subtitle", text: "Por qual criança devemos começar a contar a fila do banho de hoje?" }));

  const card = el("div", { class: "card" });
  let selected = state.startChildId || state.children[0].id;

  const optionsWrap = el("div");
  function paintOptions() {
    optionsWrap.innerHTML = "";
    state.children.forEach(child => {
      const opt = el("div", { class: "radio-option" + (selected === child.id ? " selected" : "") }, [
        el("div", { class: "mini-avatar", text: initials(child.name) }),
        el("span", { text: child.name }),
      ]);
      opt.addEventListener("click", () => {
        selected = child.id;
        paintOptions();
      });
      optionsWrap.appendChild(opt);
    });
  }
  paintOptions();
  card.appendChild(optionsWrap);
  wrap.appendChild(card);

  const confirmBtn = el("button", { class: "btn-primary", text: "Começar a partir de hoje" });
  confirmBtn.addEventListener("click", () => {
    state.startChildId = selected;
    state.startDate = todayISO();
    persist();
    view = "dashboard";
    render();
  });
  wrap.appendChild(confirmBtn);

  if (state.startDate) {
    const backBtn = el("button", { class: "btn-secondary", text: "Voltar" });
    backBtn.style.marginTop = "10px";
    backBtn.addEventListener("click", () => { view = "dashboard"; render(); });
    wrap.appendChild(backBtn);
  }

  app.appendChild(wrap);
}

// ---------- Tela 3: dashboard ----------
function renderDashboard() {
  const wrap = el("div");
  wrap.appendChild(el("h1", { text: "Banho da Vez" }));
  wrap.appendChild(el("p", { class: "subtitle", text: "Quem toma banho hoje" }));
  renderSyncBanner(wrap);

  const today = todayISO();
  const child = childForDate(today);

  const dCard = el("div", { class: "card dashboard-card" });
  dCard.appendChild(el("div", { class: "date", text: new Date(today + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) }));
  dCard.appendChild(el("div", { class: "avatar", text: child ? initials(child.name) : "?" }));
  dCard.appendChild(el("div", { class: "label", text: "Hoje toma banho:" }));
  dCard.appendChild(el("div", { class: "child-name", text: child ? child.name : "—" }));
  wrap.appendChild(dCard);

  wrap.appendChild(el("div", { class: "section-title", text: "Próximos dias" }));
  const list = el("ul", { class: "queue-list" });
  for (let i = 0; i < 7; i++) {
    const iso = addDaysISO(today, i);
    const c = childForDate(iso);
    const item = el("li", { class: "queue-item" + (i === 0 ? " today" : "") });
    item.appendChild(el("span", { text: c ? c.name : "—" }));
    item.appendChild(el("span", { class: "day", text: formatDateLabel(iso, today) }));
    list.appendChild(item);
  }
  wrap.appendChild(list);

  const footer = el("div", { class: "footer-actions" });
  const manageBtn = el("button", { class: "btn-secondary", text: "Gerenciar crianças" });
  manageBtn.addEventListener("click", () => { view = "manage"; render(); });
  const restartBtn = el("button", { class: "btn-secondary", text: "Reiniciar fila" });
  restartBtn.addEventListener("click", () => { view = "start"; render(); });
  footer.appendChild(manageBtn);
  footer.appendChild(restartBtn);
  wrap.appendChild(footer);

  app.appendChild(wrap);
}

// ---------- Tela 4: gerenciar crianças (depois do setup inicial) ----------
function renderManage() {
  const wrap = el("div");
  wrap.appendChild(el("h1", { text: "Gerenciar crianças" }));
  wrap.appendChild(el("p", { class: "subtitle", text: "Adicione, remova ou ajuste a fila" }));

  const card = el("div", { class: "card" });
  const list = el("div");
  state.children.forEach(child => {
    const row = el("div", { class: "child-row" });
    const nameWrap = el("div", { class: "name" }, [
      el("div", { class: "mini-avatar", text: initials(child.name) }),
      el("span", { text: child.name }),
    ]);
    const removeBtn = el("button", { class: "btn-danger", text: "Remover" });
    removeBtn.addEventListener("click", () => {
      if (state.children.length <= 2) {
        alert("É necessário manter pelo menos 2 crianças.");
        return;
      }
      state.children = state.children.filter(c => c.id !== child.id);
      if (state.startChildId === child.id) {
        state.startChildId = state.children[0].id;
        state.startDate = todayISO();
      }
      persist();
      render();
    });
    row.appendChild(nameWrap);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
  card.appendChild(list);

  const addRow = el("div", { class: "add-row" });
  const input = el("input", { attrs: { type: "text", placeholder: "Nome da criança" } });
  const addBtn = el("button", { class: "btn-primary", text: "Adicionar" });
  function addChild() {
    const name = input.value.trim();
    if (!name) return;
    state.children.push({ id: uid(), name });
    persist();
    input.value = "";
    render();
  }
  addBtn.addEventListener("click", addChild);
  input.addEventListener("keydown", e => { if (e.key === "Enter") addChild(); });
  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  card.appendChild(addRow);

  wrap.appendChild(card);

  const backBtn = el("button", { class: "btn-primary", text: "Voltar ao dashboard" });
  backBtn.addEventListener("click", () => { view = "dashboard"; render(); });
  wrap.appendChild(backBtn);

  app.appendChild(wrap);
}
