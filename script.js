const selectChantier = document.getElementById("chantierSelect");
const thead = document.querySelector("thead");
const tbody = document.querySelector("tbody");

const COLONNE_PRIX = 5; // 6e colonne

// Nettoyage prix
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

// Sélection chantier
selectChantier.addEventListener("change", () => {
    const chantier = selectChantier.value;
    if (!chantier) return;

    fetch(`data/${chantier}.csv`)
        .then(res => res.text())
        .then(text => afficherCSV(text, chantier));
});

function afficherCSV(text, chantierName) {
    thead.innerHTML = "";
    tbody.innerHTML = "";

    const lignes = text.trim().split("\n");
    if (lignes.length < 2) return;

    // En-têtes
    const headers = lignes[0].split(",");
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

    // Regroupement par lot
    const groupes = {};
    lignes.slice(1).forEach((ligne, index) => {
        const cells = ligne.split(",");
        const lot = cells[0]?.trim();
        if (!lot) return;

        if (!groupes[lot]) groupes[lot] = [];
        groupes[lot].push({ cells, index });
    });

    let etatCases = JSON.parse(localStorage.getItem("etatCases-" + chantierName)) || {};

    Object.keys(groupes).forEach(lot => {

        // Ignorer séparateurs
        if (lot === "-" || lot.includes("___")) return;

        let totalLot = 0;
        let restantLot = 0;

        groupes[lot].forEach(item => {
            const prix = parsePrix(item.cells[COLONNE_PRIX]);
            totalLot += prix;
            if (!etatCases[item.index]) {
                restantLot += prix;
            }
        });

        // Ligne lot
        const trLot = document.createElement("tr");
        trLot.style.background = "#eee";
        trLot.style.cursor = "pointer";

        const tdLot = document.createElement("td");
        tdLot.colSpan = headers.length + 1;
        tdLot.style.fontWeight = "bold";
        tdLot.textContent =
            `${lot} — Total : ${totalLot.toFixed(2)} € | Restant : ${restantLot.toFixed(2)} €`;

        trLot.appendChild(tdLot);
        tbody.appendChild(trLot);

        const lignesLot = [];

        // Lignes enfants
        groupes[lot].forEach(item => {
            const tr = document.createElement("tr");
            tr.style.display = "none";

            item.cells.forEach((cell, i) => {
                const td = document.createElement("td");
                td.textContent = i === 0 ? "" : cell;
                tr.appendChild(td);
            });

            const tdCheck = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = etatCases[item.index] || false;

            if (checkbox.checked) tr.style.textDecoration = "line-through";

            checkbox.addEventListener("change", () => {
                etatCases[item.index] = checkbox.checked;
                localStorage.setItem(
                    "etatCases-" + chantierName,
                    JSON.stringify(etatCases)
                );

                tr.style.textDecoration = checkbox.checked ? "line-through" : "none";

                // Recalcul restant
                let nouveauRestant = 0;
                groupes[lot].forEach(it => {
                    const p = parsePrix(it.cells[COLONNE_PRIX]);
                    if (!etatCases[it.index]) {
                        nouveauRestant += p;
                    }
                });

                tdLot.textContent =
                    `${lot} — Total : ${totalLot.toFixed(2)} € | Restant : ${nouveauRestant.toFixed(2)} €`;
            });

            tdCheck.appendChild(checkbox);
            tr.appendChild(tdCheck);

            tbody.appendChild(tr);
            lignesLot.push(tr);
        });

        // Déroulage / repli
        trLot.addEventListener("click", () => {
            lignesLot.forEach(l =>
                l.style.display = l.style.display === "none" ? "" : "none"
            );
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
