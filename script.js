// ====== UTILITAIRE ======
function parsePrix(val){
    if(!val) return 0;
    return parseFloat(val.toString().replace(/\s/g,"").replace("€","")) || 0;
}

// ====== ELEMENTS ======
const searchInput = document.getElementById("searchInput");
const select = document.getElementById("chantierSelect");
const table = document.getElementById("mainTable");
const thead = table.querySelector("thead");
const tbody = table.querySelector("tbody");
const totalGlobalSpan = document.getElementById("totalGlobalSpan");
const restantGlobalSpan = document.getElementById("restantGlobalSpan");

// ====== DONNEES ======
let allChantiersData = {}; // { fichier: [{cells,index,fichier}] }
let etatCasesGlobal = {}; // { "fichier-index": true/false }

// ====== CHARGEMENT INDEX ======
fetch("data/index.csv")
.then(res=>res.text())
.then(text=>{
    const lignes = text.trim().split("\n").slice(1);
    lignes.forEach(ligne=>{
        const [nom,fichier] = ligne.split(",");
        const option = document.createElement("option");
        option.value=fichier; option.textContent=nom;
        select.appendChild(option);
    });
});

// ====== CHARGEMENT DES CSV ======
function loadSelectedChantiers(callback){
    const selectedFiles = Array.from(select.selectedOptions).map(o=>o.value).filter(v=>v);
    if(selectedFiles.length===0){ 
        tbody.innerHTML="";thead.innerHTML=""; 
        totalGlobalSpan.textContent=""; restantGlobalSpan.textContent=""; 
        return; 
    }

    Promise.all(selectedFiles.map(f=>{
        if(allChantiersData[f]) return allChantiersData[f];
        return fetch("data/"+f).then(r=>r.text()).then(text=>{
            const lignes = text.trim().split("\n");
            if(lignes.length<=1) return [];
            const data = lignes.slice(1).map((ligne,index)=>({cells:ligne.split(","), index, fichier:f}));
            allChantiersData[f]=data;
            return data;
        });
    })).then(results=>{
        const merged = results.flat();
        callback(merged);
    });
}

// ====== AFFICHAGE TABLEAU ======
function afficherTable(data, openLots=false){
    tbody.innerHTML=""; thead.innerHTML="";
    if(data.length===0) return;

    // Headers (adapte si nécessaire)
    const headers = ["Lot","Nom","Col3","Col4","Col5","Prix"];
    const trHead=document.createElement("tr");
    headers.forEach(h=>{ 
        const th=document.createElement("th"); 
        th.textContent=h; 
        trHead.appendChild(th); 
    });
    const thCheck=document.createElement("th"); 
    thCheck.textContent="Fait"; 
    trHead.appendChild(thCheck);
    thead.appendChild(trHead);

    // Grouper par lot
    const groupes = {};
    data.forEach(item=>{
        const lot = item.cells[0].trim();
        if(!groupes[lot]) groupes[lot]=[];
        groupes[lot].push(item);
    });

    let totalGlobal=0; let totalGlobalRestant=0;

    Object.keys(groupes).forEach(lot=>{
        if(lot.includes("___")||lot==="-"||groupes[lot].length===0) return;

        let totalLot=0, totalRestant=0;
        groupes[lot].forEach(it=>{
            const prix=parsePrix(it.cells[5]);
            totalLot+=prix;
            const key=it.fichier+"-"+it.index;
            if(!etatCasesGlobal[key]) totalRestant+=prix;
        });
        totalGlobal+=totalLot; totalGlobalRestant+=totalRestant;

        // Ligne Lot
        const trLot=document.createElement("tr"); trLot.className="lot";
        const tdLot=document.createElement("td"); tdLot.colSpan=headers.length+1;
        const headerDiv=document.createElement("div"); 
        headerDiv.style.display="flex"; 
        headerDiv.style.justifyContent="space-between";
        const nomLot=document.createElement("span"); 
        nomLot.textContent=lot;
        const totaux=document.createElement("span"); totaux.className="totaux";
        totaux.innerHTML=`<span>Total : <strong>${totalLot.toFixed(2)} €</strong></span>
                           <span class="restant">Restant : <strong>${totalRestant.toFixed(2)} €</strong></span>`;
        headerDiv.appendChild(nomLot); 
        headerDiv.appendChild(totaux); 
        tdLot.appendChild(headerDiv); 
        trLot.appendChild(tdLot); 
        tbody.appendChild(trLot);

        const lotLines=[];
        groupes[lot].forEach(it=>{
            const tr=document.createElement("tr"); tr.style.display="none";
            it.cells.forEach((c,idx)=>{
                const td=document.createElement("td"); 
                td.textContent=idx===0?"":c; 
                tr.appendChild(td);
            });
            const tdCheck=document.createElement("td");
            const checkbox=document.createElement("input"); 
            checkbox.type="checkbox";
            const key=it.fichier+"-"+it.index;
            checkbox.checked=etatCasesGlobal[key]||false;
            if(checkbox.checked) tr.style.textDecoration="line-through";

            checkbox.addEventListener("change",()=>{
                tr.style.textDecoration=checkbox.checked?"line-through":"none";
                etatCasesGlobal[key]=checkbox.checked;

                // Recalcul totaux lot
                let newRestantLot=0;
                groupes[lot].forEach(i=>{ 
                    const k=i.fichier+"-"+i.index; 
                    if(!etatCasesGlobal[k]) newRestantLot+=parsePrix(i.cells[5]); 
                });
                totaux.querySelector(".restant").innerHTML=`Restant : <strong>${newRestantLot.toFixed(2)} €</strong>`;

                // Recalcul global
                let newGlobalRestant=0;
                Object.keys(groupes).forEach(l=>{
                    groupes[l].forEach(i=>{
                        const k=i.fichier+"-"+i.index; 
                        if(!etatCasesGlobal[k]) newGlobalRestant+=parsePrix(i.cells[5]); 
                    });
                });
                restantGlobalSpan.innerHTML=`Restant global : <strong>${newGlobalRestant.toFixed(2)} €</strong>`;
            });

            tdCheck.appendChild(checkbox); 
            tr.appendChild(tdCheck); 
            tbody.appendChild(tr); 
            lotLines.push(tr);
        });

        // Toggle Lot
        trLot.addEventListener("click",()=>{ 
            lotLines.forEach(tr=>tr.style.display=tr.style.display==="none"?"":"none"); 
        });

        // Déplier automatiquement si openLots = true (recherche)
        if(openLots) lotLines.forEach(tr=>tr.style.display="");
    });

    totalGlobalSpan.innerHTML=`Total global : <strong>${totalGlobal.toFixed(2)} €</strong>`;
    restantGlobalSpan.innerHTML=`Restant global : <strong>${totalGlobalRestant.toFixed(2)} €</strong>`;
}

// ====== FILTRAGE ======
function filterAndDisplay(){
    const query=searchInput.value.trim().toLowerCase();
    loadSelectedChantiers(allData=>{
        let filtered = allData;
        if(query!=="") filtered = allData.filter(d=>d.cells[1].toLowerCase().includes(query));
        afficherTable(filtered, query!==""); // openLots = true si recherche
    });
}

// ====== EVENTS ======
searchInput.addEventListener("input", filterAndDisplay);
select.addEventListener("change", filterAndDisplay);
