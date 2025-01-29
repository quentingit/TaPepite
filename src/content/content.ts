// Assurez-vous d'avoir installé les types de Chrome avec `npm install --save-dev @types/chrome`

// Initialisation d'un cache global pour stocker les données récupérées
const dataCache: Map<string, string> = new Map();

// Interface pour représenter un quartier
interface Quartier {
  quartier: string;
  display: boolean;
}

// Réinitialiser le stockage des quartiers
const reinitialiserStorageQuartiers = (callback?: () => void): void => {
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

// Initialiser le stockage des quartiers
const initialiserStorageQuartiers = (callback?: () => void): void => {
  chrome.storage.local.get(
    ["quartiersDecouverts"],
    (result: { quartiersDecouverts?: Quartier[] }) => {
      if (!result.quartiersDecouverts) {
        // Initialiser la clé avec un tableau vide si elle n'existe pas
        chrome.storage.local.set({ quartiersDecouverts: [] }, () => {
          console.log("Clé quartiersDecouverts initialisée.");
          if (callback) callback();
        });
      } else {
        if (callback) callback();
      }
    }
  );
};

// Calculer la rentabilité
const calculerRentabilite = (prix: number, surface: number): number | null => {
  if (!prix || !surface) {
    return null;
  }
  const loyerAnnuel: number = surface * 15 * 12; // Hypothèse simplifiée
  const rentabilite: string = ((loyerAnnuel / prix) * 100).toFixed(2);
  return parseFloat(rentabilite);
};

// Récupérer les détails d'une annonce
const fetchDetails = async (url: string): Promise<string | null> => {
  // Vérifie si l'URL est déjà dans le cache
  if (dataCache.has(url)) {
    console.log(`Données récupérées du cache pour ${url}`);
    return dataCache.get(url) || null;
  }

  try {
    // Premier appel pour récupérer le texte
    const response: Response = await fetch(url);
    const text: string = await response.text();
    const match: RegExpMatchArray | null = text.match(
      /"key":"district_id","value":"(\d+)"/
    );

    if (match) {
      console.log("La valeur associée est :", match[1]);
      const districtId: string = match[1];

      // Appel à l'API pour obtenir le "libelle"
      const apiUrl: string = `https://api.leboncoin.fr/api/re-pro-enrichment/district/v1/id/${districtId}`;
      const apiResponse: Response = await fetch(apiUrl);
      if (!apiResponse.ok) {
        console.error("Erreur lors de l'appel à l'API :", apiResponse.status);
        return "Erreur API pour récupérer le libellé";
      }

      const apiData: any = await apiResponse.json();
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
const quartiersDecouverts: Set<string> = new Set();

// Ajouter un quartier
const ajouterQuartier = (quartier: string | null | undefined): void => {
  if (
    quartier &&
    quartier !== "Erreur lors de la récupération des données" &&
    quartier !== "Quartier non trouvé"
  ) {
    chrome.storage.local.get(
      ["quartiersDecouverts"],
      (result: { quartiersDecouverts?: Quartier[] }) => {
        const quartiersExistants: Quartier[] = result.quartiersDecouverts || [];

        // Vérifie si le quartier existe déjà
        const quartierExistant: boolean = quartiersExistants.some(
          (q: Quartier) => q.quartier.toLowerCase() === quartier.toLowerCase()
        );

        if (!quartierExistant) {
          // Ajoute le quartier s'il n'existe pas déjà
          quartiersExistants.push({
            quartier,
            display: true,
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
      }
    );
  }
};

// Ajouter un badge de rentabilité discret
const ajouterCalculRentabiliteDiscret = (): void => {
  const annonces: NodeListOf<Element> = document.querySelectorAll(
    '[data-qa-id="aditem_container"]'
  );

  annonces.forEach(async (annonce: Element) => {
    const lien: HTMLAnchorElement | null = annonce.querySelector("a");

    // Vérifier si la rentabilité a déjà été ajoutée
    if (annonce.querySelector(".badge-rentabilite")) return;

    // Récupérer le prix et la surface
    const prixElement: HTMLElement | null = annonce.querySelector(
      '[data-test-id="price"] span'
    );
    const surfaceElement: HTMLElement | null = annonce.querySelector("h2");

    if (prixElement && surfaceElement) {
      const prixText: string =
        prixElement.textContent?.replace(/[^\d]/g, "") || "0";
      const prix: number = parseFloat(prixText);
      const surfaceMatch: RegExpMatchArray | null =
        surfaceElement.textContent?.match(/(\d+)\s?m²/) || null;
      const surface: number | null = surfaceMatch
        ? parseFloat(surfaceMatch[1])
        : null;

      const rentabilite: number | null = calculerRentabilite(
        prix,
        surface ?? 0
      );

      if (rentabilite !== null) {
        // Créer un badge discret
        const badge: HTMLSpanElement = document.createElement("span");
        badge.className = "badge-rentabilite";
        badge.textContent = `${rentabilite}%`;
        badge.style.color = rentabilite < 4 ? "red" : "green";
        badge.style.fontSize = "12px";
        badge.style.marginLeft = "10px";
        badge.style.fontWeight = "bold";

        prixElement.parentNode?.appendChild(badge);

        if (lien) {
          const url: string | null = lien.getAttribute("href");
          if (url) {
            const fullUrl: string = url.startsWith("http")
              ? url
              : `https://www.leboncoin.fr${url}`;

            // Récupérer les détails en tâche de fond
            const quartier: string | null = await fetchDetails(fullUrl);

            // Ajouter le quartier à côté du badge de rentabilité
            const quartierElement: HTMLSpanElement =
              document.createElement("span");
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
    }
  });
};

// Cacher les annonces basées sur les quartiers sélectionnés
const cacherAnnoncesQuartiers = (
  retryCount: number = 5,
  retryDelay: number = 500
): void => {
  chrome.storage.local.get(
    ["quartiersDecouverts"],
    (result: { quartiersDecouverts?: Quartier[] }) => {
      const quartiersSelectionnes: Quartier[] =
        result.quartiersDecouverts || [];

      // Sélectionne toutes les annonces sur LeBonCoin
      const annonces: NodeListOf<Element> = document.querySelectorAll(
        '[data-qa-id="aditem_container"]'
      );

      let missingBadges: Element[] = [];

      annonces.forEach((annonce: Element) => {
        console.log("Analyse de l'annonce :", annonce);
        const badgeQuartier: Element | null =
          annonce.querySelector(".badge-quartier");

        if (!badgeQuartier) {
          missingBadges.push(annonce);
          return;
        }

        const quartierTexte: string =
          badgeQuartier.textContent?.replace(" - ", "").trim() || "";

        // Vérifie si le quartier a `display: false`
        const estCache: boolean = quartiersSelectionnes.some(
          (q: Quartier) =>
            q.quartier.toLowerCase() === quartierTexte.toLowerCase() &&
            q.display === false
        );

        // Cache l'annonce si `display` est `false`
        (annonce as HTMLElement).style.display = estCache ? "none" : "block";
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
    }
  );
};

////////////
// START APP
//////////

// reinitialiserStorageQuartiers();
initialiserStorageQuartiers(() => {
  // On ajoute les infos
  ajouterCalculRentabiliteDiscret();
  // On cache les éléments filtres
  cacherAnnoncesQuartiers();

  // Observer le DOM pour les chargements dynamiques
  const observer: MutationObserver = new MutationObserver(() => {
    ajouterCalculRentabiliteDiscret();
    cacherAnnoncesQuartiers();
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

// Écouteur d'événement pour détecter les changements dans le stockage local
chrome.storage.onChanged.addListener(
  (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === "local" && changes.quartiersDecouverts) {
      console.log(
        "Modification détectée dans quartiersDecouverts :",
        changes.quartiersDecouverts.newValue
      );
      cacherAnnoncesQuartiers();
    }
  }
);
