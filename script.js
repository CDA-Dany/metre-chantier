// Sélection du body
const body = document.body;

// ===== MENU DÉROULANT =====
const select = document.createElement("select");
select.style.margin = "10px";
body.appendChild(select);

const optionDefaut = document.createElement("option");
optionDefaut.value = "";
optionDefaut.textContent = "-- Choisir un chantier --";
select.appendChild(optionDefaut);

// ===== TABLEAU =====
const table = document.createElement("table");
table.style.borderCollapse = "collapse";
table.style.marginTop = "20px";
table.style.width = "95%";
table.style.margin = "auto";
table.style.tableLayout = "fixed";

const thead = document.createElement("thead");
const tbody = document.createElement("tbody");

table.appendChild(thead);
table.appendChild(tbody);
body.appendChild(table);

// ===== FONCTION AFFICHAGE CSV =====
function afficherCSV(text, chantierName) {
    thead.innerHTML = "";
    tbody.innerHTML = "";

    const lignes = text.trim().split("\n");
    if (lignes.length <= 1) return;

    // ---- EN-TÊTES ----
    const headers = lignes[0].split(",");
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

    // ---- GROUPEMENT PAR LOT ----
    const groupes = {};
    lignes.slice(1).forEach((ligne, index) => {
        const cells = ligne.split(",");
        const lot = cells[0].trim();

        if (!groupes[lot]) groupes[lot] = [];
        groupes[lot].push({ cells, index });
    });

    // ---- ÉTAT DES CASES ----
    let etatCases = JSON.parse(
        localStorage.getItem("etatCases-" + chantierName)
    ) || {};

    // ---- CRÉATION DES LOTS ----
    Object.keys(groupes).forEach(lot => {
        // Ignorer lots inutiles
        if (lot.includes("___") || lot === "-") return;

        let totalLot = 0;
        let totalRestant = 0;
        const lotLines = [];

        // ----- CALCUL DES TOTAUX -----
        groupes[lot].forEach(item => {
            const val = item.cells[5] || "";
            const prix = parseFloat(
                val.toString().replace("€", "")
            ) || 0;

            totalLot += prix;
            if (!etatCases[item.index]) {
                totalRestant += prix;
            }
        });

        // ----- LIGNE LOT (PARENT) -----
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
            <span style="margin-right:15px;">Total : ${totalLot.toFixed(2)} €</span>
            <span>Restant : ${totalRestant.toFixed(2)} €</span>
        `;

        headerDiv.appendChild(nomLot);
        headerDiv.appendChild(totaux);
        tdLot.appendChild(headerDiv);
        trLot.appendChild(tdLot);
        tbody.appendChild(trLot);

        // ----- LIGNES ENFANTS -----
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
            });

            tdCheck.appendChild(checkbox);
            tr.appendChild(tdCheck);

            tbody.appendChild(tr);
            lotLines.push(tr);
        });

        // ----- DÉROULER / REPLIER -----
        trLot.addEventListener("click", () => {
            lotLines.forEach(tr => {
                tr.style.display = tr.style.display === "none" ? "" : "none";
            });
        });
    });
}

// ===== CHARGEMENT INDEX.CSV =====
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
    })
    .catch(err => console.error("Erreur index.csv :", err));

// ===== CHARGEMENT CHANTIER =====
select.addEventListener("change", () => {
    if (!select.value) return;

    fetch("data/" + select.value)
        .then(res => res.text())
        .then(text => afficherCSV(text, select.value))
        .catch(err => console.error("Erreur CSV chantier :", err));
});
