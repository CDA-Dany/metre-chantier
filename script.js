// =====================
// UTILITAIRE PRIX
// =====================
function parsePrix(val) {
    if (!val) return 0;
    return parseFloat(
        val
            .toString()
            .replace(/\s/g, "")
            .replace("€", "")
    ) || 0;
}

// =====================
// STRUCTURE PAGE
// =====================
const body = document.body;

// ----- Menu déroulant -----
const select = document.createElement("select");
select.style.margin = "10px";
body.appendChild(select);

const optionDefaut = document.createElement("option");
optionDefaut.value = "";
optionDefaut.textContent = "-- Choisir un chantier --";
select.appendChild(optionDefaut);

// ----- Résumé global -----
const resumeGlobal = document.createElement("div");
resumeGlobal.style.width = "95%";
resumeGlobal.style.margin = "15px auto";
resumeGlobal.style.padding = "10px 15px";
resumeGlobal.style.border = "1px solid #ccc";
resumeGlobal.style.background = "#f8f8f8";
resumeGlobal.style.display = "flex";
resumeGlobal.style.justifyContent = "flex-end";
resumeGlobal.style.gap = "40px";
resumeGlobal.style.fontWeight = "bold";

const totalGlobalSpan = document.createElement("span");
const restantGlobalSpan = document.createElement("span");

resumeGlobal.appendChild(totalGlobalSpan);
resumeGlobal.appendChild(restantGlobalSpan);


// ----- Tableau -----
const table = document.createElement("table");
table.style.borderCollapse = "collapse";
table.style.margin = "20px auto";
table.style.width = "95%";
table.style.tableLayout = "fixed";

const thead = document.createElement("thead");
const tbody = document.createElement("tbody");

table.appendChild(thead);
table.appendChild(tbody);
body.appendChild(table);
body.appendChild(resumeGlobal);

// =====================
// AFFICHAGE CSV
// =====================
function afficherCSV(text, chantierName) {
    thead.innerHTML = "";
    tbody.innerHTML = "";

    let totalGlobal = 0;
    let totalGlobalRestant = 0;

    const lignes = text.trim().split("\n");
    if (lignes.length <= 1) return;

    const headers = lignes[0].split(",");

    // ----- EN-TÊTES -----
    const trHead = document.createElement("tr");
    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        th.style.padding = "6px";
        th.style.background = "#333";
        th.style.color = "white";
        trHead.appendChild(th);
    });

    const thCheck = document.createElement("th");
    thCheck.textContent = "Fait";
    thCheck.style.background = "#333";
    thCheck.style.color = "white";
    trHead.appendChild(thCheck);

    thead.appendChild(trHead);

    // ----- GROUPEMENT PAR LOT -----
    const groupes = {};
    lignes.slice(1).forEach((ligne, index) => {
        const cells = ligne.split(",");
        const lot = cells[0].trim();
        if (!groupes[lot]) groupes[lot] = [];
        groupes[lot].push({ cells, index });
    });

    let etatCases = JSON.parse(
        localStorage.getItem("etatCases-" + chantierName)
    ) || {};

    // ----- LOTS -----
    Object.keys(groupes).forEach(lot => {
        if (lot.includes("___") || lot === "-") return;

        let totalLot = 0;
        let totalRestant = 0;

        groupes[lot].forEach(item => {
            const prix = parsePrix(item.cells[5]);
            totalLot += prix;
            if (!etatCases[item.index]) {
                totalRestant += prix;
            }
        });

        totalGlobal += totalLot;
        totalGlobalRestant += totalRestant;

        // ---- Ligne LOT ----
        const trLot = document.createElement("tr");
        trLot.style.background = "#f2f2f2";
        trLot.style.cursor = "pointer";

        const tdLot = document.createElement("td");
        tdLot.colSpan = headers.length + 1;

        const headerDiv = document.createElement("div");
        headerDiv.style.display = "flex";
        headerDiv.style.justifyContent = "space-between";
        headerDiv.style.alignItems = "center";
        headerDiv.style.fontWeight = "bold";

        const nomLot = document.createElement("span");
        nomLot.textContent = lot;

        const totaux = document.createElement("span");
        totaux.style.fontWeight = "normal";
        totaux.style.fontSize = "13px";
        totaux.innerHTML = `
            <span style="margin-right:20px;">
                Total : <strong>${totalLot.toFixed(2)} €</strong>
            </span>
            <span class="restant">
                Restant : <strong>${totalRestant.toFixed(2)} €</strong>
            </span>
        `;

        headerDiv.appendChild(nomLot);
        headerDiv.appendChild(totaux);
        tdLot.appendChild(headerDiv);
        trLot.appendChild(tdLot);
        tbody.appendChild(trLot);

        // ---- Lignes enfants ----
        const lotLines = [];

        groupes[lot].forEach(item => {
            const tr = document.createElement("tr");
            tr.style.display = "none";

            item.cells.forEach((cell, idx) => {
                const td = document.createElement("td");
                td.textContent = idx === 0 ? "" : cell;
                td.style.padding = "6px";
                tr.appendChild(td);
            });

            const tdCheck = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = etatCases[item.index] || false;

            if (checkbox.checked) {
                tr.style.textDecoration = "line-through";
            }

            checkbox.addEventListener("change", () => {
                tr.style.textDecoration = checkbox.checked ? "line-through" : "none";
                etatCases[item.index] = checkbox.checked;

                localStorage.setItem(
                    "etatCases-" + chantierName,
                    JSON.stringify(etatCases)
                );

                // 🔄 recalcul restant LOT
                let newRestantLot = 0;
                groupes[lot].forEach(it => {
                    if (!etatCases[it.index]) {
                        newRestantLot += parsePrix(it.cells[5]);
                    }
                });

                totaux.querySelector(".restant").innerHTML =
                    `Restant : <strong>${newRestantLot.toFixed(2)} €</strong>`;

                // 🔄 recalcul restant GLOBAL
                let newGlobalRestant = 0;
                Object.keys(groupes).forEach(l => {
                    groupes[l].forEach(it => {
                        if (!etatCases[it.index]) {
                            newGlobalRestant += parsePrix(it.cells[5]);
                        }
                    });
                });

                restantGlobalSpan.innerHTML =
                    `Restant global : <strong>${newGlobalRestant.toFixed(2)} €</strong>`;
            });

            tdCheck.appendChild(checkbox);
            tr.appendChild(tdCheck);
            tbody.appendChild(tr);
            lotLines.push(tr);
        });

        trLot.addEventListener("click", () => {
            lotLines.forEach(tr =>
                tr.style.display = tr.style.display === "none" ? "" : "none"
            );
        });
    });

    // ----- Affichage global -----
    totalGlobalSpan.innerHTML =
        `Total global : <strong>${totalGlobal.toFixed(2)} €</strong>`;

    restantGlobalSpan.innerHTML =
        `Restant global : <strong>${totalGlobalRestant.toFixed(2)} €</strong>`;
}

// =====================
// CHARGEMENT INDEX
// =====================
fetch("data/index.csv")
    .then(res => res.text())
    .then(text => {
        const lignes = text.trim().split("\n").slice(1);
        lignes.forEach(ligne => {
            const [nom, fichier] = ligne.split(",");
            const option = document.createElement("option");
            option.value = fichier;
            option.textContent = nom;
            select.appendChild(option);
        });
    });

// =====================
// CHANGEMENT CHANTIER
// =====================
select.addEventListener("change", () => {
    if (!select.value) return;
    fetch("data/" + select.value)
        .then(res => res.text())
        .then(text => afficherCSV(text, select.value));
});

