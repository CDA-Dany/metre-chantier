// =====================
// Sélections HTML
// =====================
const searchInput = document.getElementById("searchInput");
const chantierBox = document.getElementById("chantierCheckboxes");
const table = document.getElementById("mainTable");
const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");

const totalGlobalSpan = document.getElementById("totalGlobalSpan");
const restantGlobalSpan = document.getElementById("restantGlobalSpan");

// =====================
// Tooltip chantier
// =====================
const tooltip = document.createElement("div");
tooltip.style.cssText = `
    position:fixed;
    background:#222;
    color:#fff;
    padding:6px 10px;
    border-radius:6px;
    font-size:12px;
    pointer-events:none;
    display:none;
    z-index:9999;
`;
document.body.appendChild(tooltip);

// =====================
let chantiers = [];
let csvCache = {};
let chantiersActifs = new Set();
let etatLots = {};

// =====================
function parsePrix(v) {
    return parseFloat(
        (v || "0")
            .replace("€", "")
            .replace(/\s/g, "")
            .replace(",", ".")
    ) || 0;
}

// =====================
// Charger index.csv
// =====================
fetch("data/index.csv")
    .then(r => r.text())
    .then(t => {
        t.trim().split("\n").slice(1).forEach(l => {
            const [nom, fichier] = l.split(",");
            chantiers.push({ nom: nom.trim(), fichier: fichier.trim() });
        });
        afficherChantiers();
    });

// =====================
function afficherChantiers() {
    chantierBox.innerHTML = "";
    chantiers.forEach(c => {
        const label = document.createElement("label");
        label.style.display = "block";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.addEventListener("change", () => {
            cb.checked ? chantiersActifs.add(c) : chantiersActifs.delete(c);
            chargerCSV(c);
            render();
        });

        label.appendChild(cb);
        label.append(" " + c.nom);
        chantierBox.appendChild(label);
    });
}

// =====================
function chargerCSV(c) {
    if (csvCache[c.fichier]) return;
    fetch("data/" + c.fichier)
        .then(r => r.text())
        .then(t => {
            csvCache[c.fichier] = t;
            render();
        });
}

// =====================
// RENDER
// =====================
function render() {
    thead.innerHTML = "";
    tbody.innerHTML = "";

    let globalTotal = 0;
    let globalRestant = 0;
    let headerDone = false;

    const lots = {};
    const pliages = {};

    chantiersActifs.forEach(c => {
        const txt = csvCache[c.fichier];
        if (!txt) return;

        const lignes = txt.trim().split("\n");
        const headers = lignes[0].split(",");

        if (!headerDone) {
            const tr = document.createElement("tr");
            headers.forEach(h => tr.appendChild(Object.assign(document.createElement("th"), { textContent: h })));
            tr.appendChild(Object.assign(document.createElement("th"), { textContent: "Fait" }));
            thead.appendChild(tr);
            headerDone = true;
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
            cible[lot].push({ cells, i, c, etats });
        });
    });

    function creerLot(nomLot, data, indent = 0) {
        let total = 0;
        let restant = 0;

        data.forEach(d => {
            const p = parsePrix(d.cells[5]);
            total += p;
            if (!d.etats[d.i]) restant += p;
        });

        globalTotal += total;
        globalRestant += restant;

        const ouvert = !!etatLots[nomLot];
        const fleche = ouvert ? "▾" : "▸";

        const trLot = document.createElement("tr");
        trLot.style.background = "#f2f2f2";
        trLot.style.cursor = "pointer";

        const td = document.createElement("td");
        td.colSpan = 7;
        td.style.paddingLeft = indent + "px";
        td.innerHTML = `
            ${fleche} <strong>${nomLot}</strong>
            <span style="float:right">${total.toFixed(2)} € | ${restant.toFixed(2)} €</span>
        `;
        trLot.appendChild(td);
        tbody.appendChild(trLot);

        data.forEach(d => {
            const tr = document.createElement("tr");
            tr.style.display = ouvert ? "" : "none";

            d.cells.forEach((cell, idx) => {
                const td = document.createElement("td");
                td.textContent = idx === 0 ? "" : cell;

                if (idx === 1) {
                    td.style.cursor = "help";
                    td.addEventListener("mouseenter", () => {
                        tooltip.textContent = d.c.nom;
                        tooltip.style.display = "block";
                    });
                    td.addEventListener("mousemove", e => {
                        tooltip.style.left = e.clientX + 12 + "px";
                        tooltip.style.top = e.clientY + 12 + "px";
                    });
                    td.addEventListener("mouseleave", () => tooltip.style.display = "none");
                }

                tr.appendChild(td);
            });

            const tdCheck = document.createElement("td");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!d.etats[d.i];
            cb.addEventListener("change", () => {
                d.etats[d.i] = cb.checked;
                localStorage.setItem("etat-" + d.c.fichier, JSON.stringify(d.etats));
                render();
            });
            tdCheck.appendChild(cb);
            tr.appendChild(tdCheck);

            tbody.appendChild(tr);
        });

        trLot.addEventListener("click", () => {
            etatLots[nomLot] = !etatLots[nomLot];
            render();
        });

        return { total, restant };
    }

    // Lots classiques
    Object.keys(lots).forEach(lot => creerLot(lot, lots[lot]));

    // =====================
    // LOT MÈRE : PLIAGES (avec totaux)
    // =====================
    if (Object.keys(pliages).length) {
        let totalPliages = 0;
        let restantPliages = 0;

        Object.keys(pliages).forEach(lot => {
            pliages[lot].forEach(d => {
                const p = parsePrix(d.cells[5]);
                totalPliages += p;
                if (!d.etats[d.i]) restantPliages += p;
            });
        });

        const ouvert = !!etatLots["Pliages"];
        const fleche = ouvert ? "▾" : "▸";

        const tr = document.createElement("tr");
        tr.style.background = "#f2f2f2";
        tr.style.cursor = "pointer";

        const td = document.createElement("td");
        td.colSpan = 7;
        td.innerHTML = `
            ${fleche} <strong>Pliages</strong>
            <span style="float:right">${totalPliages.toFixed(2)} € | ${restantPliages.toFixed(2)} €</span>
        `;
        tr.appendChild(td);
        tbody.appendChild(tr);

        tr.addEventListener("click", () => {
            etatLots["Pliages"] = !etatLots["Pliages"];
            render();
        });

        if (ouvert) {
            Object.keys(pliages).forEach(lot =>
                creerLot(lot, pliages[lot], 30)
            );
        }
    }

    totalGlobalSpan.textContent = `Total global : ${globalTotal.toFixed(2)} €`;
    restantGlobalSpan.textContent = `Restant global : ${globalRestant.toFixed(2)} €`;
}

searchInput.addEventListener("input", render);
