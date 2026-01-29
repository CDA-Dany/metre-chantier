// =====================
// Sélections HTML
// =====================
const searchInput = document.getElementById("searchInput");
const chantierList = document.getElementById("chantierCheckboxes");

const table = document.getElementById("mainTable");
const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");

const totalGlobalSpan = document.getElementById("totalGlobalSpan");
const restantGlobalSpan = document.getElementById("restantGlobalSpan");

// =====================
// Tooltip chantier
// =====================
const tooltip = document.createElement("div");
tooltip.style.position = "fixed";
tooltip.style.pointerEvents = "none";
tooltip.style.background = "#222";
tooltip.style.color = "#fff";
tooltip.style.padding = "6px 10px";
tooltip.style.borderRadius = "6px";
tooltip.style.fontSize = "12px";
tooltip.style.whiteSpace = "nowrap";
tooltip.style.zIndex = "9999";
tooltip.style.display = "none";
tooltip.style.boxShadow = "0 4px 10px rgba(0,0,0,0.25)";
document.body.appendChild(tooltip);

// =====================
// Données globales
// =====================
let chantiers = [];          // [{nom, fichier}]
let csvCache = {};          // contenu CSV
let chantiersActifs = new Set();

// =====================
// Utils
// =====================
function parsePrix(val) {
    if (!val) return 0;
    return parseFloat(
        val
            .toString()
            .replace("€", "")
            .replace(/\s/g, "")
            .replace(",", ".")
    ) || 0;
}

// =====================
// Charger index.csv
// =====================
fetch("data/index.csv")
    .then(res => res.text())
    .then(text => {
        const lignes = text.trim().split("\n").slice(1);
        lignes.forEach(ligne => {
            const [nom, fichier] = ligne.split(",");
            chantiers.push({ nom: nom.trim(), fichier: fichier.trim() });
        });
        afficherCheckboxes();
    });

// =====================
// Checkboxes chantiers
// =====================
function afficherCheckboxes() {
    chantierList.innerHTML = "";

    chantiers.forEach(c => {
        const label = document.createElement("label");
        label.style.display = "block";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = c.fichier;

        cb.addEventListener("change", () => {
            if (cb.checked) {
                chantiersActifs.add(c);
                chargerCSV(c);
            } else {
                chantiersActifs.delete(c);
            }
            render();
        });

        label.appendChild(cb);
        label.append(" " + c.nom);
        chantierList.appendChild(label);
    });
}

// =====================
// Charger CSV chantier
// =====================
function chargerCSV(chantier) {
    if (csvCache[chantier.fichier]) return;

    fetch("data/" + chantier.fichier)
        .then(res => res.text())
        .then(text => {
            csvCache[chantier.fichier] = text;
            render();
        });
}

// =====================
// RENDER GLOBAL
// =====================
function render() {
    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (chantiersActifs.size === 0) return;

    let globalTotal = 0;
    let globalRestant = 0;
    let headersDone = false;

    chantiersActifs.forEach(chantier => {
        const text = csvCache[chantier.fichier];
        if (!text) return;

        const lignes = text.trim().split("\n");
        const headers = lignes[0].split(",");

        if (!headersDone) {
            const trHead = document.createElement("tr");
            headers.forEach(h => {
                const th = document.createElement("th");
                th.textContent = h;
                trHead.appendChild(th);
            });
            const thCheck = document.createElement("th");
            thCheck.textContent = "Fait";
            trHead.appendChild(thCheck);
            thead.appendChild(trHead);
            headersDone = true;
        }

        const groupes = {};

        lignes.slice(1).forEach((ligne, index) => {
            const cells = ligne.split(",");
            const lot = cells[0]?.trim();
            const nom = cells[1]?.toLowerCase() || "";

            if (!lot || lot === "-" || lot.includes("___")) return;
            if (searchInput.value && !nom.includes(searchInput.value.toLowerCase())) return;

            if (!groupes[lot]) groupes[lot] = [];
            groupes[lot].push({ cells, index });
        });

        const etatCases =
            JSON.parse(localStorage.getItem("etat-" + chantier.fichier)) || {};

        Object.keys(groupes).forEach(lot => {
            let lotTotal = 0;
            let lotRestant = 0;

            groupes[lot].forEach(item => {
                const prix = parsePrix(item.cells[5]);
                lotTotal += prix;
                if (!etatCases[item.index]) lotRestant += prix;
            });

            globalTotal += lotTotal;
            globalRestant += lotRestant;

            // ===== Ligne LOT =====
            const trLot = document.createElement("tr");
            trLot.style.background = "#f0f0f0";
            trLot.style.cursor = "pointer";

            const tdLot = document.createElement("td");
            tdLot.colSpan = headers.length + 1;
            tdLot.innerHTML = `<strong>${lot}</strong>
                <span style="float:right">
                    Total : ${lotTotal.toFixed(2)} € |
                    Restant : ${lotRestant.toFixed(2)} €
                </span>`;

            trLot.appendChild(tdLot);
            tbody.appendChild(trLot);

            const lignesLot = [];

            groupes[lot].forEach(item => {
                const tr = document.createElement("tr");
                tr.style.display = "none";

                item.cells.forEach((cell, idx) => {
                    const td = document.createElement("td");
                    td.textContent = idx === 0 ? "" : cell;

                    // 👉 TOOLTIP UNIQUEMENT SUR LA COLONNE NOM
                    if (idx === 1) {
                        td.style.cursor = "help";

                        td.addEventListener("mouseenter", () => {
                            tooltip.textContent = chantier.nom;
                            tooltip.style.display = "block";
                        });

                        td.addEventListener("mousemove", (e) => {
                            tooltip.style.left = e.clientX + 12 + "px";
                            tooltip.style.top = e.clientY + 12 + "px";
                        });

                        td.addEventListener("mouseleave", () => {
                            tooltip.style.display = "none";
                        });
                    }

                    tr.appendChild(td);
                });

                const tdCheck = document.createElement("td");
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = !!etatCases[item.index];

                if (cb.checked) tr.style.textDecoration = "line-through";

                cb.addEventListener("change", () => {
                    etatCases[item.index] = cb.checked;
                    localStorage.setItem(
                        "etat-" + chantier.fichier,
                        JSON.stringify(etatCases)
                    );
                    render();
                });

                tdCheck.appendChild(cb);
                tr.appendChild(tdCheck);

                tbody.appendChild(tr);
                lignesLot.push(tr);
            });

            trLot.addEventListener("click", () => {
                lignesLot.forEach(tr => {
                    tr.style.display =
                        tr.style.display === "none" ? "" : "none";
                });
            });
        });
    });

    totalGlobalSpan.textContent =
        "Total global : " + globalTotal.toFixed(2) + " €";
    restantGlobalSpan.textContent =
        "Restant global : " + globalRestant.toFixed(2) + " €";
}

// =====================
// Recherche temps réel
// =====================
searchInput.addEventListener("input", render);
