/**********************
 * OUTILS
 **********************/
function parsePrix(val) {
    if (!val) return 0;
    return (
        parseFloat(
            val
                .toString()
                .replace("€", "")
                .replace(/\s/g, "")
                .replace(",", ".")
        ) || 0
    );
}

/**********************
 * TOOLTIP
 **********************/
const tooltip = document.createElement("div");
Object.assign(tooltip.style, {
    position: "fixed",
    pointerEvents: "none",
    background: "#222",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    whiteSpace: "nowrap",
    zIndex: 9999,
    display: "none",
    boxShadow: "0 4px 10px rgba(0,0,0,0.25)"
});
document.body.appendChild(tooltip);

/**********************
 * INTERFACE
 **********************/
const controls = document.getElementById("controls");
const tableContainer = document.getElementById("table-container");

// Recherche
const searchInput = document.createElement("input");
searchInput.placeholder = "🔍 Rechercher (colonne nom)…";
searchInput.style.width = "300px";
searchInput.style.margin = "10px auto";
searchInput.style.display = "block";
controls.appendChild(searchInput);

// Liste chantiers
const chantierList = document.createElement("div");
controls.appendChild(chantierList);

// Tableau
const table = document.createElement("table");
table.style.width = "100%";
table.style.borderCollapse = "collapse";
table.style.marginTop = "15px";
tableContainer.appendChild(table);

const thead = document.createElement("thead");
const tbody = document.createElement("tbody");
table.appendChild(thead);
table.appendChild(tbody);

// Totaux globaux
const totalsDiv = document.createElement("div");
totalsDiv.style.marginTop = "15px";
totalsDiv.style.fontWeight = "bold";
tableContainer.appendChild(totalsDiv);

/**********************
 * DONNÉES
 **********************/
let chantiers = [];
let csvData = {};
let selectedChantiers = new Set();

/**********************
 * CHARGER INDEX
 **********************/
fetch("data/index.csv")
    .then(r => r.text())
    .then(text => {
        text.trim().split("\n").slice(1).forEach(l => {
            const [nom, fichier] = l.split(",");
            chantiers.push({ nom, fichier });

            const label = document.createElement("label");
            label.style.display = "block";
            label.style.cursor = "pointer";

            const cb = document.createElement("input");
            cb.type = "checkbox";

            cb.addEventListener("change", () => {
                cb.checked
                    ? selectedChantiers.add(fichier)
                    : selectedChantiers.delete(fichier);
                render();
            });

            label.appendChild(cb);
            label.append(" " + nom);
            chantierList.appendChild(label);
        });
    });

/**********************
 * CHARGER CSV
 **********************/
function loadCSV(fichier) {
    if (csvData[fichier]) return Promise.resolve(csvData[fichier]);

    return fetch("data/" + fichier)
        .then(r => r.text())
        .then(text => {
            const rows = text.trim().split("\n").map(l => l.split(","));
            csvData[fichier] = rows;
            return rows;
        });
}

/**********************
 * RENDER
 **********************/
async function render() {
    thead.innerHTML = "";
    tbody.innerHTML = "";
    totalsDiv.textContent = "";

    if (selectedChantiers.size === 0) return;

    let headersSet = false;
    let globalTotal = 0;
    let globalRestant = 0;

    for (const chantier of chantiers) {
        if (!selectedChantiers.has(chantier.fichier)) continue;

        const rows = await loadCSV(chantier.fichier);
        const headers = rows[0];
        const data = rows.slice(1);

        if (!headersSet) {
            const tr = document.createElement("tr");
            headers.forEach(h => {
                const th = document.createElement("th");
                th.textContent = h;
                th.style.border = "1px solid #ccc";
                th.style.padding = "6px";
                tr.appendChild(th);
            });
            const thFait = document.createElement("th");
            thFait.textContent = "Fait";
            tr.appendChild(thFait);
            thead.appendChild(tr);
            headersSet = true;
        }

        const groupes = {};
        data.forEach((row, idx) => {
            const lot = row[0].trim();
            if (!groupes[lot]) groupes[lot] = [];
            groupes[lot].push({ row, idx, chantier });
        });

        Object.keys(groupes).forEach(lot => {
            if (lot === "-" || lot.includes("___")) return;

            let totalLot = 0;
            let restantLot = 0;
            const lignes = [];

            groupes[lot].forEach(item => {
                const prix = parsePrix(item.row[5]);
                const key = item.chantier.fichier + "-" + item.idx;
                const fait = JSON.parse(localStorage.getItem(key)) || false;

                totalLot += prix;
                if (!fait) restantLot += prix;

                globalTotal += prix;
                if (!fait) globalRestant += prix;

                lignes.push({ ...item, prix, fait, key });
            });

            // Ligne LOT
            const trLot = document.createElement("tr");
            trLot.style.background = "#eee";
            trLot.style.cursor = "pointer";

            const tdLot = document.createElement("td");
            tdLot.colSpan = headers.length + 1;
            tdLot.innerHTML = `
                <span style="font-weight:bold">${lot}</span>
                <span style="float:right">
                    Total : ${totalLot.toFixed(2)} € |
                    Restant : ${restantLot.toFixed(2)} €
                </span>
            `;

            tdLot.addEventListener("mouseenter", e => {
                tooltip.textContent = chantier.nom;
                tooltip.style.display = "block";
            });
            tdLot.addEventListener("mousemove", e => {
                tooltip.style.left = e.clientX + 12 + "px";
                tooltip.style.top = e.clientY + 12 + "px";
            });
            tdLot.addEventListener("mouseleave", () => {
                tooltip.style.display = "none";
            });

            trLot.appendChild(tdLot);
            tbody.appendChild(trLot);

            const enfants = [];

            lignes.forEach(l => {
                const tr = document.createElement("tr");
                tr.style.display = "none";
                tr.addEventListener("mouseenter", () => tr.style.background = "#f5f5f5");
                tr.addEventListener("mouseleave", () => tr.style.background = "");

                l.row.forEach((cell, i) => {
                    const td = document.createElement("td");
                    td.textContent = i === 0 ? "" : cell;
                    td.style.border = "1px solid #ddd";
                    td.style.padding = "5px";
                    tr.appendChild(td);
                });

                const tdCheck = document.createElement("td");
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = l.fait;

                cb.addEventListener("change", () => {
                    localStorage.setItem(l.key, cb.checked);
                    render();
                });

                tdCheck.appendChild(cb);
                tr.appendChild(tdCheck);

                tbody.appendChild(tr);
                enfants.push(tr);
            });

            trLot.addEventListener("click", () => {
                enfants.forEach(tr => {
                    tr.style.display = tr.style.display === "none" ? "" : "none";
                });
            });
        });
    }

    totalsDiv.textContent =
        `TOTAL GLOBAL : ${globalTotal.toFixed(2)} € — ` +
        `RESTANT : ${globalRestant.toFixed(2)} €`;
}

/**********************
 * RECHERCHE
 **********************/
searchInput.addEventListener("input", () => {
    const val = searchInput.value.toLowerCase();
    [...tbody.children].forEach(tr => {
        if (tr.children.length < 2) return;
        const text = tr.textContent.toLowerCase();
        tr.style.display = text.includes(val) ? "" : "none";
    });
});
