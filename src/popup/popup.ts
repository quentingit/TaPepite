document.addEventListener("DOMContentLoaded", async () => {
  console.log("Script du popup chargé !");

  // Vérifie si l'utilisateur est sur Leboncoin
  chrome.tabs.query(
    { active: true, currentWindow: true },
    (tabs: chrome.tabs.Tab[]) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.url?.includes("leboncoin.fr")) {
        // Afficher un message d'erreur si l'utilisateur n'est pas sur Leboncoin
        document.body.innerHTML = `
        <h1>TaPépite</h1>
        <p style="color: red; text-align: center; font-weight: bold;">
          🚨 Vous devez être sur <strong>Leboncoin</strong> pour utiliser cette extension.
        </p>
      `;
      }
    }
  );

  const quartiersList = document.getElementById(
    "quartiers-list"
  ) as HTMLElement | null;
  if (!quartiersList) {
    console.error("Élément avec l'ID 'quartiers-list' non trouvé.");
    return;
  }

  // Création des boutons Sélectionner tout et Désélectionner tout
  const buttonsContainer: HTMLDivElement = document.createElement("div");
  buttonsContainer.style.marginBottom = "10px";
  buttonsContainer.style.display = "flex";
  buttonsContainer.style.justifyContent = "space-between";

  const selectAllButton: HTMLButtonElement = document.createElement("button");
  selectAllButton.textContent = "Sélectionner tout";
  selectAllButton.style.padding = "10px 20px";
  selectAllButton.style.marginRight = "5px";
  selectAllButton.style.backgroundColor = "#3498db";
  selectAllButton.style.color = "#fff";
  selectAllButton.style.border = "none";
  selectAllButton.style.borderRadius = "5px";
  selectAllButton.style.cursor = "pointer";
  selectAllButton.style.fontSize = "14px";

  const deselectAllButton: HTMLButtonElement = document.createElement("button");
  deselectAllButton.textContent = "Désélectionner tout";
  deselectAllButton.style.padding = "10px 20px";
  deselectAllButton.style.backgroundColor = "#e74c3c";
  deselectAllButton.style.color = "#fff";
  deselectAllButton.style.border = "none";
  deselectAllButton.style.borderRadius = "5px";
  deselectAllButton.style.cursor = "pointer";
  deselectAllButton.style.fontSize = "14px";

  buttonsContainer.appendChild(selectAllButton);
  buttonsContainer.appendChild(deselectAllButton);
  quartiersList.parentNode?.insertBefore(buttonsContainer, quartiersList);

  interface Quartier {
    quartier: string;
    display: boolean;
  }

  const updateQuartiersList = (quartiers: Quartier[]): void => {
    quartiersList.innerHTML = ""; // Réinitialise la liste avant mise à jour

    chrome.storage.local.get(
      ["quartiersDecouverts"],
      (result: { quartiersDecouverts?: Quartier[] }) => {
        const quartiersSelectionnes: Quartier[] =
          result.quartiersDecouverts || [];

        // Trie les quartiers par ordre alphabétique
        quartiers.sort((a, b) => a.quartier.localeCompare(b.quartier));

        quartiers.forEach(({ quartier, display }) => {
          const quartierDiv: HTMLDivElement = document.createElement("div");
          quartierDiv.className = "quartier quartier-style";
          quartierDiv.style.backgroundColor = display ? "#1abc9c" : "#ecf0f1"; // Vert si actif, gris clair sinon
          quartierDiv.style.padding = "10px";
          quartierDiv.style.margin = "5px";
          quartierDiv.style.borderRadius = "8px";
          quartierDiv.style.textAlign = "center";
          quartierDiv.style.cursor = "pointer";
          quartierDiv.style.transition =
            "background-color 0.3s ease, transform 0.2s ease";
          quartierDiv.style.fontSize = "14px";
          quartierDiv.style.fontWeight = "bold";
          quartierDiv.style.boxShadow = "0px 2px 5px rgba(0,0,0,0.1)";
          quartierDiv.style.display = "flex";
          quartierDiv.style.justifyContent = "center";
          quartierDiv.style.alignItems = "center";

          const label: HTMLLabelElement = document.createElement("label");
          label.htmlFor = quartier;
          label.textContent = quartier;

          quartierDiv.appendChild(label);
          quartiersList.appendChild(quartierDiv);

          console.log("Ajout du quartier :", quartier);

          quartierDiv.addEventListener("mouseover", () => {
            quartierDiv.style.transform = "scale(1.05)";
            quartierDiv.style.boxShadow = "0px 4px 8px rgba(0,0,0,0.2)";
          });
          quartierDiv.addEventListener("mouseleave", () => {
            quartierDiv.style.transform = "scale(1)";
            quartierDiv.style.boxShadow = "0px 2px 5px rgba(0,0,0,0.1)";
          });

          // Ajoute un écouteur pour mettre à jour le stockage local
          quartierDiv.addEventListener("click", () => {
            chrome.storage.local.get(
              ["quartiersDecouverts"],
              (data: { quartiersDecouverts?: Quartier[] }) => {
                let updatedQuartiers: Quartier[] =
                  data.quartiersDecouverts || [];

                updatedQuartiers = updatedQuartiers.map((q: Quartier) =>
                  q.quartier === quartier ? { ...q, display: !q.display } : q
                );

                // Sauvegarde dans chrome.storage.local
                chrome.storage.local.set(
                  { quartiersDecouverts: updatedQuartiers },
                  () => {
                    console.log(
                      "Mise à jour des quartiers enregistrée :",
                      updatedQuartiers
                    );

                    // Récupère le nouvel état du quartier
                    const quartierMisAJour: Quartier | undefined =
                      updatedQuartiers.find((q) => q.quartier === quartier);

                    if (quartierMisAJour) {
                      // Met à jour la couleur du fond après modification
                      quartierDiv.style.backgroundColor =
                        quartierMisAJour.display ? "#1abc9c" : "#ecf0f1";
                    }

                    // Met à jour l'affichage des annonces
                    hideLBCAdsBasedOnQuartiers();
                  }
                );
              }
            );
          });
        });
      }
    );
  };

  // Fonction pour sélectionner ou désélectionner tous les quartiers
  const setAllQuartiers = (displayValue: boolean): void => {
    chrome.storage.local.get(
      ["quartiersDecouverts"],
      (result: { quartiersDecouverts?: Quartier[] }) => {
        let updatedQuartiers: Quartier[] = result.quartiersDecouverts || [];

        updatedQuartiers = updatedQuartiers.map((q: Quartier) => ({
          ...q,
          display: displayValue,
        }));

        chrome.storage.local.set(
          { quartiersDecouverts: updatedQuartiers },
          () => {
            console.log(
              displayValue
                ? "Tous les quartiers ont été sélectionnés."
                : "Tous les quartiers ont été désélectionnés.",
              updatedQuartiers
            );
            updateQuartiersList(updatedQuartiers);
            hideLBCAdsBasedOnQuartiers();
          }
        );
      }
    );
  };

  // Écouteurs pour les boutons
  selectAllButton.addEventListener("click", () => setAllQuartiers(true));
  deselectAllButton.addEventListener("click", () => setAllQuartiers(false));

  // Charge les quartiers
  const loadQuartiers = async (): Promise<void> => {
    chrome.storage.local.get(
      ["quartiersDecouverts"],
      (result: { quartiersDecouverts?: Quartier[] }) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Erreur lors de la récupération des données:",
            chrome.runtime.lastError
          );
          return;
        }
        const quartiers: Quartier[] = result.quartiersDecouverts || [];
        console.log("Quartiers chargés :", quartiers);
        updateQuartiersList(quartiers);
      }
    );
  };

  // Cache les annonces sur LeBonCoin en fonction des quartiers décochés
  const hideLBCAdsBasedOnQuartiers = (): void => {
    chrome.storage.local.get(
      ["quartiersDecouverts"],
      (result: { quartiersDecouverts?: Quartier[] }) => {
        const quartiersSelectionnes: Quartier[] =
          result.quartiersDecouverts || [];

        // Sélectionne toutes les annonces sur LeBonCoin (assure-toi que la classe CSS correspond)
        const annonces: NodeListOf<Element> = document.querySelectorAll(
          '[data-qa-id="aditem_container"]'
        );

        annonces.forEach((annonce: Element) => {
          console.log("Annonce analysée :", annonce);
          const badgeQuartier: Element | null =
            annonce.querySelector(".badge-quartier"); // Quartier attaché à l'annonce
          const quartierTexte: string | null = badgeQuartier
            ? badgeQuartier.textContent?.trim().toLowerCase() || null
            : null;

          // Détermine si le quartier est sélectionné
          const estQuartierSelectionne: boolean = quartierTexte
            ? quartiersSelectionnes.some(
                (q: Quartier) => q.quartier.toLowerCase() === quartierTexte
              )
            : false;

          // Cache l'annonce si le quartier n'est pas sélectionné
          (annonce as HTMLElement).style.display = estQuartierSelectionne
            ? "block"
            : "none";
        });
      }
    );
  };

  await loadQuartiers();
  // Exécuter la fonction immédiatement au chargement
  hideLBCAdsBasedOnQuartiers();

  // Appeler la fonction initialement et sur les changements de chrome.storage.local
  chrome.storage.onChanged.addListener(
    (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.quartiersDecouverts) {
        console.log(
          "Mise à jour des quartiers détectée :",
          changes.quartiersDecouverts.newValue
        );
        hideLBCAdsBasedOnQuartiers();
        updateQuartiersList(changes.quartiersDecouverts.newValue as Quartier[]);
      }
    }
  );
});
