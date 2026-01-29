// ====== UTILITAIRE ======
function parsePrix(val){
    if(!val) return 0;
    return parseFloat(
        val.toString()
            .replace(/\s/g, "")
            .replace("€", "")
    ) || 0;
}

// ====== ELEMENTS ======
const searchInput = document.getElementById("searchInput");
const checkboxContainer = document.getElementById("chantierCheckboxes");
const table = document.getElementById("mainTable");
const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");
const totalGlobalSpan = document.getElementById("totalGlobalSpan");
const restantGlobalSpan = document.getElementById("restantGlobalSpan");

// ====== DONNEES ======
let allChantiersData = {};   // cache CSV
let etatCasesGlobal = {};   // état "fait"

// ====== CHARGEMENT INDEX ======
fetch("data/index.csv")
.then(res => res.text())
.then(text => {
    const lignes = text.trim().split("\n").slice(1);

    lignes.forEach(ligne => {
        const [nom, fichier] = ligne.split(",");

        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "6px";
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = fichier;
        
        checkbox.addEventListener("change", filterAndDisplay);
        
        const text = document.createElement("span");
        text.textContent = nom;
        text.style.cursor = "default"; // texte non cliquable
        
        wrapper.appendChild(checkbox);
        wrapper.appendChild(text);
        checkboxContainer.appendChild(wrapper);

    });
});

// ====== CHARGEMENT DES CSV SELECTIONNES ======
function loadSelectedChantiers(callback){
    const checkedFiles = Array.from(
        checkboxContainer.querySelectorAll("input[type=checkbox]:checked")
    ).map(cb => cb.value);

    if(checkedFiles.length === 0){
        tbody.innerHTML = "";
        thead.innerHTML = "";
        totalGlobalSpan.textContent = "";
        restantGlobalSpan.textContent = "";
        return;
    }

    Promise.all(checkedFiles.map(file => {
        if(allChantiersData[file]) return allChantiersData[file];

        return fetch("data/" + file)
            .then(r => r.text())
            .then(text => {
                const lignes = text.trim().split("\n");
                if(lignes.length <= 1) return [];

                const data = lignes.slice(1).map((ligne, index) => ({
                    cells: ligne.split(","),
                    index,
                    fichier: file
                }));

                allChantiersData[file] = data;
                return data;
            });
    })).then(results => {
        callback(results.flat());
    });
}

// ====== AFFICHAGE TABLEAU ======
function afficherTable(data, openLots = false){
    tbody.innerHTML = "";
    thead.innerHTML = "";
    if(data.length === 0) return;

    const headers = ["Lot","Nom","Col3","Col4","Col5","Prix"];

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

    // Grouper par lot
    const groupes = {};
    data.forEach(item => {
        const lot = item.cells[0].trim();
        if(!groupes[lot]) groupes[lot] = [];
        groupes[lot].push(item);
    });

    let totalGlobal = 0;
    let totalGlobalRestant = 0;

    Object.keys(groupes).forEach(lot => {
        if(lot.includes("___") || lot === "-") return;

        let totalLot = 0;
        let totalRestant = 0;

        groupes[lot].forEach(it => {
            const prix = parsePrix(it.cells[5]);
            totalLot += prix;

            const key = it.fichier + "-" + it.index;
            if(!etatCasesGlobal[key]) totalRestant += prix;
        });

        totalGlobal += totalLot;
        totalGlobalRestant += totalRestant;

        // Ligne LOT
        const trLot = document.createElement("tr");
        trLot.className = "lot";

        const tdLot = document.createElement("td");
        tdLot.colSpan = headers.length + 1;

        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.justifyContent = "space-between";

        const nomLot = document.createElement("span");
        nomLot.textContent = lot;

        const totaux = document.createElement("span");
        totaux.innerHTML = `
            Total : <strong>${totalLot.toFixed(2)} €</strong>
            | Restant : <strong>${totalRestant.toFixed(2)} €</strong>
        `;

        wrapper.appendChild(nomLot);
        wrapper.appendChild(totaux);
        tdLot.appendChild(wrapper);
        trLot.appendChild(tdLot);
        tbody.appendChild(trLot);

        const lignesLot = [];

        groupes[lot].forEach(it => {
            const tr = document.createElement("tr");
            tr.style.display = "none";

            it.cells.forEach((c, idx) => {
                const td = document.createElement("td");
                td.textContent = idx === 0 ? "" : c;
                tr.appendChild(td);
            });

            const tdCheck = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";

            const key = it.fichier + "-" + it.index;
            checkbox.checked = etatCasesGlobal[key] || false;
            if(checkbox.checked) tr.style.textDecoration = "line-through";

            checkbox.addEventListener("change", () => {
                etatCasesGlobal[key] = checkbox.checked;
                tr.style.textDecoration = checkbox.checked ? "line-through" : "none";
                filterAndDisplay();
            });

            tdCheck.appendChild(checkbox);
            tr.appendChild(tdCheck);
            tbody.appendChild(tr);
            lignesLot.push(tr);
        });

        trLot.addEventListener("click", () => {
            lignesLot.forEach(l => {
                l.style.display = l.style.display === "none" ? "" : "none";
            });
        });

        if(openLots){
            lignesLot.forEach(l => l.style.display = "");
        }
    });

    totalGlobalSpan.innerHTML = `Total global : <strong>${totalGlobal.toFixed(2)} €</strong>`;
    restantGlobalSpan.innerHTML = `Restant global : <strong>${totalGlobalRestant.toFixed(2)} €</strong>`;
}

// ====== FILTRAGE ======
function filterAndDisplay(){
    const query = searchInput.value.trim().toLowerCase();

    loadSelectedChantiers(allData => {
        let filtered = allData;

        if(query !== ""){
            filtered = allData.filter(d =>
                d.cells[1].toLowerCase().includes(query)
            );
        }

        afficherTable(filtered, query !== "");
    });
}

// ====== EVENTS ======
searchInput.addEventListener("input", filterAndDisplay);

// Tooltip chantier
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



