document.addEventListener("DOMContentLoaded", () => {
  console.log("Script du popup chargé !");

  const quartiersList = document.getElementById("quartiers-list");

  const updateQuartiersList = (quartiers) => {
    quartiersList.innerHTML = ""; //
    quartiers.forEach((quartier) => {
      const quartierDiv = document.createElement("div");
      quartierDiv.className = "quartier";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = quartier;

      const label = document.createElement("label");
      label.htmlFor = quartier;
      label.textContent = quartier;

      quartierDiv.appendChild(checkbox);
      quartierDiv.appendChild(label);
      quartiersList.appendChild(quartierDiv);

      console.log("Ajout du quartier :", quartier);
    });
  };

  const loadQuartiers = () => {
    chrome.storage.local.get(["quartiersDecouverts"], (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Erreur lors de la récupération des données:",
          chrome.runtime.lastError
        );
        return;
      }
      const quartiers = result.quartiersDecouverts || [];
      console.log("Quartiers chargés :", quartiers);
      updateQuartiersList(quartiers);
    });
  };

  loadQuartiers();

  // Écouter les changements dans chrome.storage.local
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.quartiersDecouverts) {
      console.log(
        "Mise à jour des quartiers détectée :",
        changes.quartiersDecouverts.newValue
      );
      updateQuartiersList(changes.quartiersDecouverts.newValue);
    }
  });
});
