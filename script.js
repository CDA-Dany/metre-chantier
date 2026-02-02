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

let chantiers = [];
let csvCache = {};
let chantiersActifs = new Set();
let lotsOuverts = {};

// ========================
// Tooltip chantier
// ========================
const tooltip = document.createElement("div");
tooltip.style.cssText = `
    position: fixed;
    background: #222;
    color: #fff;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
    display: none;
    z-index: 9999;
`;
document.body.appendChild(tooltip);

// ========================
// Fonction utilitaire
// ========================
function parsePrix(v) {
    return parseFloat(
        (v || "0")
            .replace("€", "")
            .replace(/\s/g, "")
            .replace(",", ".")
    ) || 0;
}

// ========================
// MENU CHANTIERS
// ========================
chantierBtn.onclick = (e) => {
    e.stopPropagation();
    chantierMenu.style.display =
        chantierMenu.style.display === "block" ? "none" : "block";
};

document.addEventListener("click", (e) => {
    if (!chantierMenu.contains(e.target) && e.target !== chantierBtn) {
        chantierMenu.style.display = "none";
    }
});

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
            const p = parsePrix(r.cells[5]); // colonne Total HT pour résumé
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
                <span class="totaux">${total.toFixed(2)} € | ${restant.toFixed(2)} €</span>
            </td>
        `;
        tr.onclick = () => {
            lotsOuverts[name] = !open;
            render();
        };
        tableBody.appendChild(tr);

        if (!open) return;

        rows.forEach(r => {
            const trL = document.createElement("tr");
            trL.className = "ligne";
            if (r.etats[r.i]) trL.classList.add("fait");

            r.cells.forEach((c, idx) => {
                const td = document.createElement("td");

                // Ajouter € après Prix HT (indice 4) et Total HT (indice 5)
                if (idx === 4 || idx === 5) {
                    td.textContent = parsePrix(c).toFixed(2) + " €";
                } else {
                    td.textContent = idx === 0 ? "" : c;
                }

                // Tooltip chantier sur colonne Nom (indice 1)
                if (idx === 1) {
                    td.style.cursor = "help";
                    td.addEventListener("mouseenter", () => {
                        tooltip.textContent = r.c.nom;
                        tooltip.style.display = "block";
                    });
                    td.addEventListener("mousemove", e => {
                        tooltip.style.left = e.clientX + 12 + "px";
                        tooltip.style.top = e.clientY + 12 + "px";
                    });
                    td.addEventListener("mouseleave", () => {
                        tooltip.style.display = "none";
                    });
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
        const all = Object.values(pliages).flat();
        drawLot("Pliages", all);
        if (lotsOuverts["Pliages"]) {
            Object.keys(pliages).forEach(l => drawLot(l, pliages[l], 30));
        }
    }

    totalGlobalSpan.textContent = `Total global : ${totalGlobal.toFixed(2)} €`;
    restantGlobalSpan.textContent = `Restant global : ${restant.toFixed(2)} €`;
}

// Recherche en temps réel
searchInput.oninput = render;
