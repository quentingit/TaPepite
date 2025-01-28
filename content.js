// Initialisation d'un cache global pour stocker les données récupérées
const dataCache = new Map();

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

// Fonction pour ajouter et stocker les quartiers
const ajouterQuartier = (quartier) => {
  if (
    quartier &&
    quartier !== "Erreur lors de la récupération des données" &&
    quartier !== "Quartier non trouvé"
  ) {
    quartiersDecouverts.add(quartier);

    // Mise à jour dans chrome.storage.local
    chrome.storage.local.set(
      { quartiersDecouverts: Array.from(quartiersDecouverts) },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Erreur lors de la sauvegarde :",
            chrome.runtime.lastError
          );
        } else {
          console.log(
            "Quartiers enregistrés avec succès dans chrome.storage.local :",
            quartiersDecouverts
          );
        }
      }
    );
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

// Exécuter la fonction
ajouterCalculRentabiliteDiscret();

// Observer le DOM pour les chargements dynamiques
const observer = new MutationObserver(ajouterCalculRentabiliteDiscret);
observer.observe(document.body, { childList: true, subtree: true });
