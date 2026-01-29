fetch("data/index.csv")
    .then(res => res.text())
    .then(text => {
        // Diviser en lignes
        const lignes = text.trim().split("\n");

        // Récupérer les en-têtes (séparateur ;)
        const headers = lignes[0].split(";");

        // Créer le menu déroulant
        const select = document.createElement("select");
        document.body.appendChild(select);
        const optionDefaut = document.createElement("option");
        optionDefaut.value = "";
        optionDefaut.textContent = "-- Choisir un chantier --";
        select.appendChild(optionDefaut);

        lignes.slice(1).forEach(ligne => {
            const [nom, fichier] = ligne.split(";"); // <-- ici le ;
            const option = document.createElement("option");
            option.value = fichier;
            option.textContent = nom;
            select.appendChild(option);
        });
    });
