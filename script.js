document.addEventListener("DOMContentLoaded", () => {

    const selectChantier = document.getElementById("chantierSelect");
    const thead = document.querySelector("thead");
    const tbody = document.querySelector("tbody");

    if (!selectChantier) {
        console.error("❌ Select chantier introuvable");
        return;
    }

    const COLONNE_PRIX = 5;

    function parsePrix(val) {
        if (!val) return 0;
        return parseFloat(
            val.toString()
               .replace("€", "")
               .replace(/\s/g, "")
               .replace(",", ".")
        ) || 0;
    }

    // Option vide
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "-- Sélectionner un chantier --";
    selectChantier.appendChild(opt);

    // Charger index.csv
    fetch("data/index.csv")
        .then(res => res.text())
        .then(text => {
            text.trim().split("\n").forEach(ligne => {
                const nom = ligne.replace(".csv", "").trim();
                if (!nom) return;

                const option = document.createElement("option");
                option.value = nom;
                option.textContent = nom;
                selectChantier.appendChild(option);
            });
        })
        .catch(err => console.error("❌ Erreur chargement index.csv", err));

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

            if (lot === "-" || lot.includes("___")) return;

            let totalLot = 0;
            let restantLot = 0;

            groupes[lot].forEach(item => {
                const prix = parsePrix(item.cells[COLONNE_PRIX]);
                totalLot += prix;
                if (!etatCases[item.index]) restantLot += prix;
            });

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
                    localStorage.setItem("etatCases-" + chantierName, JSON.stringify(etatCases));
                    tr.style.textDecoration = checkbox.checked ? "line-through" : "none";

                    let nouveauRestant = 0;
                    groupes[lot].forEach(it => {
                        const p = parsePrix(it.cells[COLONNE_PRIX]);
                        if (!etatCases[it.index]) nouveauRestant += p;
                    });

                    tdLot.textContent =
                        `${lot} — Total : ${totalLot.toFixed(2)} € | Restant : ${nouveauRestant.toFixed(2)} €`;
                });

                tdCheck.appendChild(checkbox);
                tr.appendChild(tdCheck);

                tbody.appendChild(tr);
                lignesLot.push(tr);
            });

            trLot.addEventListener("click", () => {
                lignesLot.forEach(l =>
                    l.style.display = l.style.display === "none" ? "" : "none"
                );
            });
        });
    }

});
