// Sélection de l'élément body pour ajouter les composants
const body = document.body;

// Création du menu déroulant
const select = document.createElement("select");
body.appendChild(select);

// Option par défaut
const optionDefaut = document.createElement("option");
optionDefaut.value = "";
optionDefaut.textContent = "-- Choisir un chantier --";
select.appendChild(optionDefaut);

// Création du tableau HTML
const table = document.createElement("table");
table.border = 1;
table.style.borderCollapse = "collapse";
table.style.marginTop = "20px";

// Thead et Tbody
const thead = document.createElement("thead");
const tbody = document.createElement("tbody");
table.appendChild(thead);
table.appendChild(tbody);
body.appendChild(table);

// Fonction pour afficher le CSV du chantier
function afficherCSV(text) {
    thead.innerHTML = "";
    tbody.innerHTML = "";

    const lignes = text.trim().split("\n");
    if (lignes.length === 0) return;

    // En-têtes
    const headers = lignes[0].split(","); // <- séparateur virgule
    const trHead = document.createElement("tr");
    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        th.style.padding = "5px";
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    // Lignes
    lignes.slice(1).forEach(ligne => {
        const tr = document.createElement("tr");
        ligne.split(",").forEach(cell => { // <- séparateur virgule
            const td = document.createElement("td");
            td.textContent = cell;
            td.style.padding = "5px";
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// Charger index.csv et remplir le menu
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
        .then(text => afficherCSV(text))
        .catch(err => console.error("Erreur fetch CSV chantier :", err));
});
