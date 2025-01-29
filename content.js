// Initialisation d'un cache global pour stocker les données récupérées
const dataCache = new Map();

const reinitialiserStorageQuartiers = (callback) => {
  chrome.storage.local.set({ quartiersDecouverts: [] }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "Erreur lors de la réinitialisation :",
        chrome.runtime.lastError
      );
    } else {
      console.log("La clé quartiersDecouverts a été réinitialisée.");
      if (callback) callback();
    }
  });
};

const initialiserStorageQuartiers = (callback) => {
  chrome.storage.local.get(["quartiersDecouverts"], (result) => {
    if (!result.quartiersDecouverts) {
      // Initialiser la clé avec un tableau vide si elle n'existe pas
      chrome.storage.local.set({ quartiersDecouverts: [] }, () => {
        console.log("Clé quartiersDecouverts initialisée.");
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  });
};

const calculerRentabilite = (prix, surface) => {
  if (!prix || !surface) {
    return null;
  }
  const loyerAnnuel = surface * 15 * 12; // Hypothèse simplifiée
  const rentabilite = ((loyerAnnuel / prix) * 100).toFixed(2);
  return parseFloat(rentabilite);
};

const fetchDetails = async (url) => {
  // Vérifie si l'URL est déjà dans le cache
  if (dataCache.has(url)) {
    console.log(`Données récupérées du cache pour ${url}`);
    return dataCache.get(url);
  }

  try {
    // Premier appel pour récupérer le texte
    const response = await fetch(url);
    const text = await response.text();
    const match = text.match(/"key":"district_id","value":"(\d+)"/);

    if (match) {
      console.log("La valeur associée est :", match[1]);
      const districtId = match[1];

      // Appel à l'API pour obtenir le "libelle"
      const apiUrl = `https://api.leboncoin.fr/api/re-pro-enrichment/district/v1/id/${districtId}`;
      const apiResponse = await fetch(apiUrl);
      if (!apiResponse.ok) {
        console.error("Erreur lors de l'appel à l'API :", apiResponse.status);
        return "Erreur API pour récupérer le libellé";
      }

      const apiData = await apiResponse.json();
      if (apiData && apiData.libelle) {
        console.log("Libellé récupéré :", apiData.libelle);

        // Stocker dans le cache avant de retourner
        dataCache.set(url, apiData.libelle);

        return apiData.libelle;
      } else {
        return "Libellé non trouvé dans la réponse API";
      }
    } else {
      console.log("Quartier non trouvé dans le texte de la page");
      return null;
    }
  } catch (e) {
    console.error("Erreur :", e);
    return "Erreur lors de la récupération des données";
  }
};

// Liste globale pour stocker les quartiers découverts
const quartiersDecouverts = new Set();
const ajouterQuartier = (quartier) => {
  if (
    quartier &&
    quartier !== "Erreur lors de la récupération des données" &&
    quartier !== "Quartier non trouvé"
  ) {
    chrome.storage.local.get(["quartiersDecouverts"], (result) => {
      const quartiersExistants = result.quartiersDecouverts || [];

      // Vérifie si le quartier existe déjà
      const quartierExistant = quartiersExistants.some(
        (q) => q.quartier.toLowerCase() === quartier.toLowerCase()
      );

      if (!quartierExistant) {
        // Ajoute le quartier s'il n'existe pas déjà
        quartiersExistants.push({
          quartier,
          display: true,
          favorite: false,
        });

        // Mise à jour dans chrome.storage.local
        chrome.storage.local.set(
          { quartiersDecouverts: quartiersExistants },
          () => {
            if (chrome.runtime.lastError) {
              console.error(
                "Erreur lors de la sauvegarde :",
                chrome.runtime.lastError
              );
            } else {
              console.log(
                "Quartiers enregistrés avec succès dans chrome.storage.local :",
                quartiersExistants
              );
            }
          }
        );
      } else {
        console.log(
          `Le quartier "${quartier}" existe déjà, il n'a pas été ajouté.`
        );
      }
    });
  }
};

const ajouterCalculRentabiliteDiscret = () => {
  const annonces = document.querySelectorAll('[data-qa-id="aditem_container"]');

  annonces.forEach(async (annonce) => {
    const lien = annonce.querySelector("a");

    // Vérifier si la rentabilité a déjà été ajoutée
    if (annonce.querySelector(".badge-rentabilite")) return;

    // Récupérer le prix et la surface
    const prixElement = annonce.querySelector('[data-test-id="price"] span');
    const surfaceElement = annonce.querySelector("h2");

    if (prixElement && surfaceElement) {
      const prix = parseFloat(prixElement.textContent.replace(/[^\d]/g, ""));
      const surfaceMatch = surfaceElement.textContent.match(/(\d+)\s?m²/);
      const surface = surfaceMatch ? parseFloat(surfaceMatch[1]) : null;

      const rentabilite = calculerRentabilite(prix, surface);

      if (rentabilite !== null) {
        // Créer un badge discret
        const badge = document.createElement("span");
        badge.className = "badge-rentabilite";
        badge.textContent = `${rentabilite}%`;
        badge.style.color = rentabilite < 4 ? "red" : "green";
        badge.style.fontSize = "12px";
        badge.style.marginLeft = "10px";
        badge.style.fontWeight = "bold";

        prixElement.parentNode.appendChild(badge);

        if (lien) {
          const url = lien.getAttribute("href");
          const fullUrl = url.startsWith("http")
            ? url
            : `https://www.leboncoin.fr${url}`;

          // Récupérer les détails en tâche de fond
          const quartier = await fetchDetails(fullUrl);

          // Ajouter le quartier à côté du badge de rentabilité
          const quartierElement = document.createElement("span");
          quartierElement.className = "badge-quartier";
          quartierElement.textContent = ` - ${quartier}`;
          quartierElement.style.color = "#555";
          quartierElement.style.fontSize = "12px";
          quartierElement.style.marginLeft = "10px";

          badge.appendChild(quartierElement);

          // Ajouter le quartier à la liste globale et le stocker
          ajouterQuartier(quartier);
        }
      }
    }
  });
};
const cacherAnnoncesQuartiers = (retryCount = 5, retryDelay = 500) => {
  chrome.storage.local.get(["quartiersDecouverts"], (result) => {
    let quartiersSelectionnes = result.quartiersDecouverts || [];

    // Sélectionne toutes les annonces sur LeBonCoin
    const annonces = document.querySelectorAll(
      '[data-qa-id="aditem_container"]'
    );

    let missingBadges = [];

    annonces.forEach((annonce) => {
      console.log("Analyse de l'annonce :", annonce);
      let badgeQuartier = annonce.querySelector(".badge-quartier");

      if (!badgeQuartier) {
        missingBadges.push(annonce);
        return;
      }

      let quartierTexte = badgeQuartier.textContent.replace(" - ", "").trim();

      // Vérifie si le quartier a `display: false`
      let estCache = quartiersSelectionnes.some(
        (q) =>
          q.quartier.toLowerCase() === quartierTexte.toLowerCase() &&
          q.display === false
      );

      // Cache l'annonce si `display` est `false`
      annonce.style.display = estCache ? "none" : "block";
    });

    // Si certaines annonces n'ont pas encore leur badge, on retente après un délai
    if (missingBadges.length > 0 && retryCount > 0) {
      console.log(
        `Retry cacherAnnoncesQuartiers - Tentative restante : ${retryCount}`
      );
      setTimeout(
        () => cacherAnnoncesQuartiers(retryCount - 1, retryDelay),
        retryDelay
      );
    }
  });
};

//////////
//START APP
//////////

//reinitialiserStorageQuartiers();
initialiserStorageQuartiers(async () => {
  //on ajoute les infos
  ajouterCalculRentabiliteDiscret();
  //on cache les elements filtres
  cacherAnnoncesQuartiers();

  // Observer le DOM pour les chargements dynamiques
  const observer = new MutationObserver(() => {
    ajouterCalculRentabiliteDiscret();
    cacherAnnoncesQuartiers();
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

// Ajoutez ici l'écouteur d'événement pour détecter les changements dans le stockage local
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.quartiersDecouverts) {
    console.log(
      "Modification détectée dans quartiersDecouverts :",
      changes.quartiersDecouverts.newValue
    );
    cacherAnnoncesQuartiers();
  }
});
