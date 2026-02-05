// ========================
// FIREBASE (MODULE)
// ========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDWRNVnwrxuxx-ykwBm4D7BXivhyg1HAtE",
    authDomain: "metre-bet-3dcb1.firebaseapp.com",
    projectId: "metre-bet-3dcb1",
    storageBucket: "metre-bet-3dcb1.firebasestorage.app",
    messagingSenderId: "2779044366",
    appId: "1:2779044366:web:141773b07da783aacd7a5f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========================
// SÉLECTIONS HTML
// ========================
const searchInput = document.getElementById("searchInput");
const tableHead = document.querySelector("thead");
const tableBody = document.querySelector("tbody");
const totalGlobalSpan = document.getElementById("totalGlobal");
const restantGlobalSpan = document.getElementById("restantGlobal");
const chantierBtn = document.getElementById("chantierBtn");
const chantierMenu = document.getElementById("chantierMenu");
const toggleFait = document.getElementById("toggleFait");

// ========================
let chantiers = [];
let csvCache = {};
let chantiersActifs = new Set();
let lotsOuverts = {};
let etatsFirestore = {}; // état temps réel

// ========================
// OUTILS
// ========================
function parsePrix(v) {
    return parseFloat(
        (v || "0").replace("€", "").replace(/\s/g, "").replace(",", ".")
    ) || 0;
}

function idLigne(c, cells, index) {
    return `${c.fichier}__${cells[0]}__${cells[1]}__${index}`;
}

// ========================
// MENU CHANTIERS
// ========================
chantierBtn.onclick = e => {
    e.stopPropagation();
    chantierMenu.style.display =
        chantierMenu.style.display === "block" ? "none" : "block";
};

document.addEventListener("click", e => {
    if (!chantierMenu.contains(e.target) && e.target !== chantierBtn) {
        chantierMenu.style.display = "none";
    }
});

toggleFait.onchange = render;

// ========================
// INDEX DES CHANTIERS
// ========================
fetch("data/index.csv")
    .then(r => r.text())
    .then(t => {
        t.trim().split("\n").slice(1).forEach(l => {
            const [nom, fichier] = l.split(",");
            chantiers.push({ nom: nom.trim(), fichier: fichier.trim() });
        });
        renderChantiers();
    });

function renderChantiers() {
    chantierMenu.innerHTML = "";
    chantiers.forEach(c => {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";

        cb.onchange = () => {
            cb.checked ? chantiersActifs.add(c) : chantiersActifs.delete(c);
            loadCSV(c);
            render();
        };

        label.appendChild(cb);
        label.append(c.nom);
        chantierMenu.appendChild(label);
    });
}

function loadCSV(c) {
    if (csvCache[c.fichier]) return;

    fetch("data/" + c.fichier)
        .then(r => r.text())
        .then(t => {
            csvCache[c.fichier] = t;
            subscribeFirestore(c);
            render();
        });
}

// ========================
// FIRESTORE — TEMPS RÉEL
// ========================
function subscribeFirestore(c) {
    const csv = csvCache[c.fichier];
    if (!csv) return;

    const lignes = csv.trim().split("\n").slice(1);

    lignes.forEach((l, i) => {
        const cells = l.split(",");
        const id = idLigne(c, cells, i);

        onSnapshot(doc(db, "taches", id), snap => {
            if (snap.exists()) {
                etatsFirestore[id] = snap.data().checked;
                render();
            }
        });
    });
}

// ========================
// RENDER TABLEAU
// ========================
function render() {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    let totalGlobal = 0;
    let restantGlobal = 0;

    const lots = {};
    const pliages = {};

    chantiersActifs.forEach(c => {
        const csv = csvCache[c.fichier];
        if (!csv) return;

        const lignes = csv.trim().split("\n");
        const headers = lignes[0].split(",");

        if (!tableHead.innerHTML) {
            const tr = document.createElement("tr");
            headers.forEach(h => tr.appendChild(Object.assign(document.createElement("th"), { textContent: h })));
            tr.appendChild(Object.assign(document.createElement("th"), { textContent: "Fait" }));
            tableHead.appendChild(tr);
        }

        lignes.slice(1).forEach((l, i) => {
            const cells = l.split(",");
            const lot = cells[0]?.trim();
            const nom = cells[1]?.toLowerCase();

            if (!lot || lot === "-" || lot.includes("___")) return;
            if (searchInput.value && !nom.includes(searchInput.value.toLowerCase())) return;

            const cible = lot.toLowerCase().includes("pliage") ? pliages : lots;
            cible[lot] ??= [];
            cible[lot].push({ c, cells, i });
        });
    });

    function drawLot(name, rows, indent = 0) {
        let total = 0;
        let restant = 0;

        rows.forEach(r => {
            const id = idLigne(r.c, r.cells, r.i);
            const fait = etatsFirestore[id];
            const p = parsePrix(r.cells[5]);
            total += p;
            if (!fait) restant += p;
        });

        if (toggleFait.checked && restant === 0) return;

        totalGlobal += total;
        restantGlobal += restant;

        const open = !!lotsOuverts[name];
        const tr = document.createElement("tr");
        tr.className = "lot";
        tr.innerHTML = `
            <td colspan="7" style="padding-left:${indent}px">
                <span class="toggle">${open ? "▾" : "▸"}</span>
                ${name}
                <span class="totaux">
                    <span class="total-gris">${total.toFixed(2)} €</span> |
                    <span class="restant">${restant.toFixed(2)} €</span>
                </span>
            </td>
        `;
        tr.onclick = () => {
            lotsOuverts[name] = !open;
            render();
        };
        tableBody.appendChild(tr);

        if (!open) return;

        rows.forEach(r => {
            const id = idLigne(r.c, r.cells, r.i);
            const fait = !!etatsFirestore[id];
            if (toggleFait.checked && fait) return;

            const trL = document.createElement("tr");
            trL.className = "ligne";
            if (fait) trL.classList.add("fait");

            r.cells.forEach((c, idx) => {
                const td = document.createElement("td");
                td.textContent = idx === 4 || idx === 5
                    ? parsePrix(c).toFixed(2) + " €"
                    : (idx === 0 ? "" : c);
                trL.appendChild(td);
            });

            const tdC = document.createElement("td");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = fait;

            cb.onchange = async () => {
                await setDoc(doc(db, "taches", id), {
                    checked: cb.checked,
                    chantier: r.c.fichier,
                    lot: r.cells[0],
                    nom: r.cells[1]
                });
            };

            tdC.appendChild(cb);
            trL.appendChild(tdC);
            tableBody.appendChild(trL);
        });
    }

    Object.keys(lots).forEach(l => drawLot(l, lots[l]));

    if (Object.keys(pliages).length) {
        const rows = Object.values(pliages).flat();
        drawLot("Pliages", rows);
        if (lotsOuverts["Pliages"]) {
            Object.keys(pliages).forEach(l => drawLot(l, pliages[l], 30));
        }
    }

    totalGlobalSpan.textContent = `Total global : ${totalGlobal.toFixed(2)} €`;
    restantGlobalSpan.textContent = `Restant global : ${restantGlobal.toFixed(2)} €`;
}

searchInput.oninput = render;
