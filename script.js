// Sélection du body
const body = document.body;

// Menu déroulant
const select = document.createElement("select");
body.appendChild(select);
const optionDefaut = document.createElement("option");
optionDefaut.value = "";
optionDefaut.textContent = "-- Choisir un chantier --";
select.appendChild(optionDefaut);

// Tableau
const table = document.createElement("table");
table.border = 1;
table.style.borderCollapse = "collapse";
table.style.marginTop = "20px";
const thead = document.createElement("thead");
const tbody = document.createElement("tbody");
table.appendChild(thead);
table.appendChild(tbody);
body.appendChild(table);

// Fonction pour afficher CSV regroupé par Lot
function afficherCSV(text, chantierName) {
    thead.innerHTML = "";
    tbody.innerHTML = "";

    const lignes = text.trim().split("\n");
    if (lignes.length === 0) return;

    // En-têtes
    const headers = lignes[0].split(",");
    const trHead = document.createElement("tr");
    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        th.style.padding = "5px";
        trHead.appendChild(th);
    });
    const thCheck = document.createElement("th");
    thCheck.textContent = "Fait";
    trHead.appendChild(thCheck);
    thead.appendChild(trHead);

    // Grouper par Lot
    const groupes = {};
    lignes.slice(1).forEach((ligne, index) => {
        const cells = ligne.split(",");
        const lot = cells[0].trim();
        if (!groupes[lot]) groupes[lot] = [];
        groupes[lot].push({cells, index});
    });

    // État des cases
    let etatCases = JSON.parse(localStorage.getItem("etatCases-" + chantierName)) || {};

    // Créer les lignes
    Object.keys(groupes).forEach(lot => {
        // Ligne Lot
        const trLot = document.createElement("tr");
        trLot.style.backgroundColor = "#eee";
        trLot.style.cursor = "pointer";

        const tdLot = document.createElement("td");
        tdLot.textContent = lot;
        tdLot.colSpan = headers.length + 1;
        tdLot.style.fontWeight = "bold";
        trLot.appendChild(tdLot);
        tbody.appendChild(trLot);

        // Lignes du lot
        groupes[lot].forEach(item => {
            const tr = document.createElement("tr");
            tr.classList.add("lotDetail");
            tr.style.display = "none";

            item.cells.forEach(cell => {
                const td = document.createElement("td");
                td.textContent = cell;
                td.style.padding = "5px";
                tr.appendChild(td);
            });

            // Case à cocher
            const tdCheck = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = etatCases[item.index] || false;

            if (checkbox.checked) tr.style.textDecoration = "line-through";

            checkbox.addEventListener("change", () => {
                tr.style.textDecoration = checkbox.checked ? "line-through" : "none";
                etatCases[item.index] = checkbox.checked;
                localStorage.setItem("etatCases-" + chantierName, JSON.stringify(etatCases));
            });

            tdCheck.appendChild(checkbox);
            tr.appendChild(tdCheck);
            tbody.appendChild(tr);
        });

        // Toggle du Lot
        trLot.addEventListener("click", () => {
            groupes[lot].forEach((_, i) => {
                const tr = tbody.querySelectorAll(".lotDetail")[i];
                tr.style.display = tr.style.display === "none" ? "" : "none";
            });
        });
    });
}

// Charger index.csv
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
    .catch(err => console.error("Erreur fetch index.csv :", err));

// Quand un chantier est sélectionné
select.addEventListener("change", () => {
    if (!select.value) return;
    fetch("data/" + select.value)
        .then(res => res.text())
        .then(text => afficherCSV(text, select.value))
        .catch(err => console.error("Erreur fetch CSV chantier :", err));
});
