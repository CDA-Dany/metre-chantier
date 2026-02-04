// ========================
// FIREBASE
// ========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc
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
// Sélections HTML
// ========================
const searchInput = document.getElementById("searchInput");
const tableHead = document.querySelector("thead");
const tableBody = document.querySelector("tbody");
const totalGlobalSpan = document.getElementById("totalGlobal");
const restantGlobalSpan = document.getElementById("restantGlobal");
const toggleFait = document.getElementById("toggleFait");

const chantierBtn = document.getElementById("chantierBtn");
const chantierMenu = document.getElementById("chantierMenu");

let chantiers = [];
let csvCache = {};
let chantiersActifs = new Set();
let lotsOuverts = {};
let lignesSelectionnees = new Set();

// ========================
// Tooltips
// ========================
const tooltipChantier = document.createElement("div");
const tooltipSelection = document.createElement("div");
[tooltipChantier, tooltipSelection].forEach(t => {
    t.style.cssText = `
        position: fixed;
        background: #222;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        display: none;
        z-index: 9999;
        white-space: nowrap;
    `;
    document.body.appendChild(t);
});

// ========================
// Firebase
// ========================
import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const db = getFirestore();

// ========================
// Utilitaires
// ========================
function parsePrix(v) {
    return parseFloat((v || "0").replace("€","").replace(/\s/g,"").replace(",", ".")) || 0;
}

// ========================
// Menu chantiers
// ========================
chantierBtn.onclick = e => {
    e.stopPropagation();
    chantierMenu.style.display = chantierMenu.style.display === "block" ? "none" : "block";
};

document.addEventListener("click", e => {
    if (!chantierMenu.contains(e.target) && e.target !== chantierBtn) {
        chantierMenu.style.display = "none";
    }
});

toggleFait.addEventListener("change", render);

// ========================
// Chargement index.csv
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
            loadCSV(c).then(render);
        };

        label.appendChild(cb);
        label.append(c.nom);
        chantierMenu.appendChild(label);
    });
}

async function loadCSV(c) {
    if (csvCache[c.fichier]) return;
    const r = await fetch("data/" + c.fichier);
    const t = await r.text();
    csvCache[c.fichier] = t;
}

// ========================
// Tooltip sélection
// ========================
function updateSelectionTooltip(e) {
    if (lignesSelectionnees.size === 0) {
        tooltipSelection.style.display = "none";
        return;
    }

    let sommeQte = 0;
    let sommePrix = 0;
    let unite = null;
    let uniteUnique = true;

    lignesSelectionnees.forEach(r => {
        const qte = parseFloat(r.cells[2].replace(",", ".")) || 0;
        const u = r.cells[3]?.trim();
        const prix = parsePrix(r.cells[5]);

        sommeQte += qte;
        sommePrix += prix;

        if (unite === null) unite = u;
        else if (unite !== u) uniteUnique = false;
    });

    tooltipSelection.innerHTML = `
        <strong>Sélection</strong><br>
        Quantité : ${uniteUnique ? `${sommeQte} ${unite}` : "?"}<br>
        Total HT : ${sommePrix.toFixed(2)} €
    `;

    tooltipSelection.style.left = e.clientX + 15 + "px";
    tooltipSelection.style.top = e.clientY + 15 + "px";
    tooltipSelection.style.display = "block";
}

// ========================
// RENDER TABLEAU
// ========================
async function render() {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    lignesSelectionnees.clear();

    let totalGlobal = 0;
    let restantGlobal = 0;
    const lots = {};
    const pliages = {};

    // Charger tous les CSV actifs et regrouper lignes
    for (const c of chantiersActifs) {
        const csv = csvCache[c.fichier];
        if (!csv) continue;

        const lignes = csv.trim().split("\n");
        const headers = lignes[0].split(",");

        // Header
        if (!tableHead.innerHTML) {
            const tr = document.createElement("tr");
            headers.forEach(h => tr.appendChild(Object.assign(document.createElement("th"), { textContent: h })));
            tr.appendChild(Object.assign(document.createElement("th"), { textContent: "Fait" }));
            tableHead.appendChild(tr);
        }

        const etats = await loadFirestoreEtat(c.fichier);

        lignes.slice(1).forEach((l, i) => {
            const cells = l.split(",");
            const lot = cells[0]?.trim();
            const nom = cells[1]?.toLowerCase() || "";

            if (!lot || lot === "-" || lot.includes("___")) return;
            if (searchInput.value && !nom.includes(searchInput.value.toLowerCase())) return;

            const cible = lot.toLowerCase().includes("pliage") ? pliages : lots;
            cible[lot] ??= [];
            cible[lot].push({ cells, i, etats, c });
        });
    }

    // Fonction pour créer un lot
    function drawLot(name, rows, indent=0) {
        let total = 0;
        let restant = 0;
        let toutesFaites = true;

        rows.forEach(r => {
            const p = parsePrix(r.cells[5]);
            total += p;
            if (!r.etats[r.i]) restant += p;
            if (!r.etats[r.i]) toutesFaites = false;
        });

        totalGlobal += total;
        restantGlobal += restant;

        if (toggleFait.checked && toutesFaites) return; // masquer le lot si tout est fait

        const open = !!lotsOuverts[name];
        const tr = document.createElement("tr");
        tr.className = "lot";
        tr.innerHTML = `
            <td colspan="7" style="padding-left:${indent}px">
                <span class="toggle">${open ? "▾" : "▸"}</span>
                <span class="${toutesFaites ? "fait total-gris" : ""}">${name}</span>
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
            if (toggleFait.checked && r.etats[r.i]) return; // masquer lignes faites

            const trL = document.createElement("tr");
            trL.className = "ligne";
            if (r.etats[r.i]) trL.classList.add("fait");

            trL.addEventListener("click", e => {
                if (!e.ctrlKey) return;
                e.stopPropagation();
                if (lignesSelectionnees.has(r)) {
                    lignesSelectionnees.delete(r);
                    trL.classList.remove("selection");
                } else {
                    lignesSelectionnees.add(r);
                    trL.classList.add("selection");
                }
            });

            trL.addEventListener("mousemove", updateSelectionTooltip);

            r.cells.forEach((c, idx) => {
                const td = document.createElement("td");
                if (idx === 4 || idx === 5) td.textContent = parsePrix(c).toFixed(2) + " €";
                else td.textContent = idx===0?"":c;

                if(idx===1){
                    td.style.cursor="help";
                    td.onmouseenter = ()=>{tooltipChantier.textContent=r.c.nom; tooltipChantier.style.display="block";}
                    td.onmousemove = e=>{tooltipChantier.style.left=e.clientX+12+"px"; tooltipChantier.style.top=e.clientY+12+"px";}
                    td.onmouseleave = ()=>tooltipChantier.style.display="none";
                }

                trL.appendChild(td);
            });

            const tdC = document.createElement("td");
            const cb = document.createElement("input");
            cb.type="checkbox";
            cb.checked=!!r.etats[r.i];
            cb.onchange=async () => {
                r.etats[r.i] = cb.checked;
                await saveFirestoreEtat(r.c.fichier, r.i, cb.checked);
                render();
            };
            tdC.appendChild(cb);
            trL.appendChild(tdC);

            tableBody.appendChild(trL);
        });
    }

    // Affichage des lots
    Object.keys(lots).forEach(l => drawLot(l, lots[l]));

    // Pliages
    if(Object.keys(pliages).length){
        let totalP=0, restantP=0, toutesFaitesP=true;
        Object.values(pliages).flat().forEach(r=>{
            const p=parsePrix(r.cells[5]);
            totalP+=p;
            if(!r.etats[r.i]) restantP+=p;
            if(!r.etats[r.i]) toutesFaitesP=false;
        });

        if(!(toggleFait.checked && toutesFaitesP)){
            const openP=!!lotsOuverts["Pliages"];
            const trP=document.createElement("tr");
            trP.className="lot";
            trP.innerHTML=`
                <td colspan="7">
                    <span class="toggle">${openP?"▾":"▸"}</span>
                    <span class="${toutesFaitesP?"fait total-gris":""}">Pliages</span>
                    <span class="totaux">
                        <span class="total-gris">${totalP.toFixed(2)} €</span> |
                        <span class="restant">${restantP.toFixed(2)} €</span>
                    </span>
                </td>
            `;
            trP.onclick=()=>{lotsOuverts["Pliages"]=!openP; render();}
            tableBody.appendChild(trP);

            if(openP) Object.keys(pliages).forEach(l=>drawLot(l,pliages[l],30));
        }
    }

    totalGlobalSpan.textContent = `Total global : ${totalGlobal.toFixed(2)} €`;
    restantGlobalSpan.textContent = `Restant global : ${restantGlobal.toFixed(2)} €`;
}

// ========================
// Firestore helpers
// ========================
async function loadFirestoreEtat(fichier){
    const etats = {};
    const querySnapshot = await getDocs(collection(db,"taches"));
    querySnapshot.forEach(docu=>{
        const data=docu.data();
        if(data.fichier===fichier) etats[data.index]=data.checked;
    });
    return etats;
}

async function saveFirestoreEtat(fichier,index,checked){
    const docRef = doc(db,"taches",`${fichier}_${index}`);
    await setDoc(docRef,{fichier,index,checked},{merge:true});
}

// ========================
// Recherche
// ========================
searchInput.oninput = render;

// ========================
// Firestore realtime
// ========================
onSnapshot(collection(db,"taches"), ()=>render());

