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
    // Colonne “Fait”
    const thCheck = document.createElement("th");
    thCheck.textContent = "Fait";
    trHead.appendChild(thCheck);
    thead.appendChild(trHead);

    // Grouper les lignes par Lot (première colonne)
    const groupes = {};
    lignes.slice(1).forEach((ligne, index) => {
        const cells = ligne.split(",");
        const lot = cells[0].trim();
        if (!groupes[lot]) groupes[lot] = [];
        groupes[lot].push({cells, index});
    });

    // Récupérer l'état des cases depuis localStorage
    let etatCases = JSON.parse(localStorage.getItem("etatCases-" + chantierName)) || {};

    // Créer les lignes du tableau
    Object.keys(groupes).forEach(lot => {
        // Ligne “header” du lot
        const trLot = document.createElement("tr");
        trLot.style.backgroundColor = "#eee";
        trLot.style.cursor = "pointer";

        const tdLot = document.createElement("td");
        tdLot.textContent = lot;
        tdLot.colSpan = headers.length + 1;
        tdLot.style.fontWeight = "bold";
        trLot.appendChild(tdLot);
        tbody.appendChild(trLot);

        // Lignes du lot (cachées par défaut)
        groupes[lot].forEach(item => {
            const tr = document.createElement("tr");
            tr.classList.add("lotDetail");
            tr.style.display = "none"; // caché par défaut

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
                if (checkbox.checked) tr.style.textDecoration = "line-through";
                else tr.style.textDecoration = "none";
                etatCases[item.index] = checkbox.checked;
                localStorage.setItem("etatCases-" + chantierName, JSON.stringify(etatCases));
            });

            tdCheck.appendChild(checkbox);
            tr.appendChild(tdCheck);

            tbody.appendChild(tr);
        });

        // Quand on clique sur le lot → toggle lignes
        trLot.addEventListener("click", () => {
            groupes[lot].forEach((_, i) => {
                const trDetail = tbody.querySelectorAll(".lotDetail")[0]; // récupère la première de chaque lot
                groupes[lot].forEach((__, j) => {
                    const tr = tbody.querySelectorAll(".lotDetail")[i + j];
                    tr.style.display = tr.style.display === "none" ? "" : "none";
                });
            });
        });
    });
}
