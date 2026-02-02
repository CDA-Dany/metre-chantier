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
document.body.appendChild(tooltip);

// =====================
// Données globales
// =====================
let chantiers = [];
let csvCache = {};
let chantiersActifs = new Set();
let lotsOuverts = {};
let sousLotsOuverts = {};

// =====================
// Utils
// =====================
function parsePrix(val) {
    if (!val) return 0;
    return parseFloat(
        val.toString()
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

        cb.addEventListener("change", () => {
            cb.checked ? chantiersActifs.add(c) : chantiersActifs.delete(c);
            chargerCSV(c);
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

    let globalTotal = 0;
    let globalRestant = 0;
    let headersDone = false;

    const groupes = {};
    const groupesPliages = {};

    chantiersActifs.forEach(chantier => {
        const text = csvCache[chantier.fichier];
        if (!text) return;

        const lignes = text.trim().split("\n");
        const headers = lignes[0].split(",");

        if (!headersDone) {
            const tr = document.createElement("tr");
            headers.forEach(h => {
                const th = document.createElement("th");
                th.textContent = h;
                tr.appendChild(th);
            });
            tr.appendChild(document.createElement("th")).textContent = "Fait";
            thead.appendChild(tr);
            headersDone = true;
        }

        const etatCases =
            JSON.parse(localStorage.getItem("etat-" + chantier.fichier)) || {};

        lignes.slice(1).forEach((ligne, index) => {
            const cells = ligne.split(",");
            const lot = cells[0]?.trim();
            const nom = cells[1]?.toLowerCase() || "";

            if (!lot || lot === "-" || lot.includes("___")) return;
            if (searchInput.value && !nom.includes(searchInput.value.toLowerCase())) return;

            const cible = lot.toLowerCase().includes("pliage")
                ? groupesPliages
                : groupes;

            if (!cible[lot]) cible[lot] = [];
            cible[lot].push({
                cells,
                index,
                chantierNom: chantier.nom,
                fichier: chantier.fichier,
                etatCases
            });
        });
    });

    // ===== AFFICHAGE NORMAL =====
    function afficherLot(lot, lignesLotData) {
        let total = 0, restant = 0;

        lignesLotData.forEach(l => {
            const p = parsePrix(l.cells[5]);
            total += p;
            if (!l.etatCases[l.index]) restant += p;
        });

        globalTotal += total;
        globalRestant += restant;

        const trLot = document.createElement("tr");
        trLot.style.background = "#f0f0f0";
        trLot.style.cursor = "pointer";

        const tdLot = document.createElement("td");
        tdLot.colSpan = 7;
        tdLot.innerHTML = `<strong>${lot}</strong>
            <span style="float:right">Total : ${total.toFixed(2)} € | Restant : ${restant.toFixed(2)} €</span>`;
        trLot.appendChild(tdLot);
        tbody.appendChild(trLot);

        const lignes = [];

        lignesLotData.forEach(item => {
            const tr = document.createElement("tr");
            tr.style.display = "none";

            item.cells.forEach((cell, idx) => {
                const td = document.createElement("td");
                td.textContent = idx === 0 ? "" : cell;

                if (idx === 1) {
                    td.addEventListener("mouseenter", () => {
                        tooltip.textContent = item.chantierNom;
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
            cb.checked = !!item.etatCases[item.index];

            cb.addEventListener("change", () => {
                item.etatCases[item.index] = cb.checked;
                localStorage.setItem("etat-" + item.fichier, JSON.stringify(item.etatCases));
                render();
            });

            tdCheck.appendChild(cb);
            tr.appendChild(tdCheck);

            tbody.appendChild(tr);
            lignes.push(tr);
        });

        if (lotsOuverts[lot]) lignes.forEach(tr => tr.style.display = "");

        trLot.addEventListener("click", () => {
            const open = lignes[0]?.style.display === "none";
            lotsOuverts[lot] = open;
            lignes.forEach(tr => tr.style.display = open ? "" : "none");
        });
    }

    Object.keys(groupes).forEach(lot => afficherLot(lot, groupes[lot]));

    // ===== LOT MÈRE PLIAGES =====
    if (Object.keys(groupesPliages).length) {
        const trMere = document.createElement("tr");
        trMere.style.background = "#ddd";
        trMere.style.cursor = "pointer";

        const tdMere = document.createElement("td");
        tdMere.colSpan = 7;
        tdMere.innerHTML = `<strong>Pliages</strong>`;
        trMere.appendChild(tdMere);
        tbody.appendChild(trMere);

        const sousLots = [];

        Object.keys(groupesPliages).forEach(sousLot => {
            afficherLot(sousLot, groupesPliages[sousLot]);
            sousLots.push(sousLot);
        });

        trMere.addEventListener("click", () => {
            sousLots.forEach(lot => {
                lotsOuverts[lot] = !lotsOuverts[lot];
            });
            render();
        });
    }

    totalGlobalSpan.textContent = `Total global : ${globalTotal.toFixed(2)} €`;
    restantGlobalSpan.textContent = `Restant global : ${globalRestant.toFixed(2)} €`;
}

searchInput.addEventListener("input", render);
