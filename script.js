// ========================
// Sélections HTML
// ========================
const searchInput = document.getElementById("searchInput");
const tableHead = document.querySelector("thead");
const tableBody = document.querySelector("tbody");
const totalGlobalSpan = document.getElementById("totalGlobal");
const restantGlobalSpan = document.getElementById("restantGlobal");

const chantierBtn = document.getElementById("chantierBtn");
const chantierMenu = document.getElementById("chantierMenu");
const toggleFait = document.getElementById("toggleFait");

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
function parsePrix(v) {
    return parseFloat(
        (v || "0").replace("€", "").replace(/\s/g, "").replace(",", ".")
    ) || 0;
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

toggleFait.addEventListener("change", () => {
    render();
});


// ========================
// Chargement index
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
            render();
        });
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
// RENDER
// ========================
function render() {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    lignesSelectionnees.clear();

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

        const etats = JSON.parse(localStorage.getItem("etat-" + c.fichier)) || {};

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
    });

    function drawLot(name, rows, indent = 0) {
        let total = 0;
        let restant = 0;

        rows.forEach(r => {
            const p = parsePrix(r.cells[5]);
            total += p;
            if (!r.etats[r.i]) restant += p;
        });

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

            // 🔥 FILTRE ON / OFF
            if (toggleFait.checked && r.etats[r.i]) return;

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

                if (idx === 4 || idx === 5) {
                    td.textContent = parsePrix(c).toFixed(2) + " €";
                } else {
                    td.textContent = idx === 0 ? "" : c;
                }

                if (idx === 1) {
                    td.style.cursor = "help";
                    td.onmouseenter = () => {
                        tooltipChantier.textContent = r.c.nom;
                        tooltipChantier.style.display = "block";
                    };
                    td.onmousemove = e => {
                        tooltipChantier.style.left = e.clientX + 12 + "px";
                        tooltipChantier.style.top = e.clientY + 12 + "px";
                    };
                    td.onmouseleave = () => tooltipChantier.style.display = "none";
                }

                trL.appendChild(td);
            });

            const tdC = document.createElement("td");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!r.etats[r.i];
            cb.onchange = () => {
                r.etats[r.i] = cb.checked;
                localStorage.setItem("etat-" + r.c.fichier, JSON.stringify(r.etats));
                render();
            };
            tdC.appendChild(cb);
            trL.appendChild(tdC);

            tableBody.appendChild(trL);
        });
    }

    Object.keys(lots).forEach(l => drawLot(l, lots[l]));

    if (Object.keys(pliages).length) {
        let totalP = 0, restantP = 0;
        Object.values(pliages).flat().forEach(r => {
            const p = parsePrix(r.cells[5]);
            totalP += p;
            if (!r.etats[r.i]) restantP += p;
        });

        const openP = !!lotsOuverts["Pliages"];
        const trP = document.createElement("tr");
        trP.className = "lot";
        trP.innerHTML = `
            <td colspan="7">
                <span class="toggle">${openP ? "▾" : "▸"}</span>
                Pliages
                <span class="totaux">
                    <span class="total-gris">${totalP.toFixed(2)} €</span> | 
                    <span class="restant">${restantP.toFixed(2)} €</span>
                </span>
            </td>
        `;
        trP.onclick = () => {
            lotsOuverts["Pliages"] = !openP;
            render();
        };
        tableBody.appendChild(trP);

        if (openP) Object.keys(pliages).forEach(l => drawLot(l, pliages[l], 30));
    }

    totalGlobalSpan.textContent = `Total global : ${totalGlobal.toFixed(2)} €`;
    restantGlobalSpan.textContent = `Restant global : ${restantGlobal.toFixed(2)} €`;
}

searchInput.oninput = render;

