document.addEventListener("DOMContentLoaded", async function () {
  await waitForAllJSONs();

  const idSelectedCard = localStorage.getItem("idSelectedCard");

  if (!idSelectedCard || idSelectedCard <= 0) {
    location.href = "./card-list.html";
    return;
  }

  const card = allCards.find((element) => element.number == idSelectedCard);

  if (!card) {
    location.href = "./card-list.html";
    return;
  }

  const cardStatus =
    card.strength > 0 || card.resistence > 0
      ? `&#9876;${card.strength} / &#10070;${card.resistence}`
      : "";

  const [similarCards, similarCardDetails] = await Promise.all([
    getRelatedCardsInDecks(card.number, allDecks, false, null, null).then(
      (cards) => cards.slice(0, 12),
    ),
    fetchRelatedCardsDetails(
      (await getRelatedCardsInDecks(card.number, allDecks, false, null, null))
        .slice(0, 12)
        .map((card) => card.idcard),
    ),
  ]);

  const relatedDecks = getRelatedDecks(
    card.number,
    similarCards,
    allDecks,
  ).slice(0, 10);

  card.rulings = getRulingsFromCard(
    card.type,
    card.subtype,
    card.categories,
    card.effects,
    card.keywords,
  );

  updateDOMElements(card, cardStatus);
  updateSimilarCardsDOM(similarCardDetails, similarCards);
  updateRelatedDecks(relatedDecks);
  loadFlavor(String(card.number));

  fillGauge("gaugeContainerStyle", card.stylePercentage);
  fillGauge("gaugeContainerArchetype", card.archetypePercentage);
});

// Função auxiliar para atualizar os elementos do DOM
function updateDOMElements(card, cardStatus) {
  const elementsToUpdate = {
    tag_cardName: card.name.toUpperCase(),
    tag_cardFlavor: card.flavor,
    tag_cardText: card.text, // Quebra de linha com <br>
    tag_cardType: card.type.toUpperCase(),
    tag_cardCategories: card.categories.split(";").join("; ").toUpperCase(),
    // tag_cardCost: String.fromCharCode(10121 + card.cost),
    tag_cardCost: card.cost,
    tag_cardStatus: cardStatus,
    tag_cardEffect: card.effects,
    tag_cardNumber: card.number,
    tag_cardCollection: card.collection,
    tag_cardDate: formatDate(card.date).toUpperCase(),
    tag_cardArtist: card.artist,
    tag_cardImg: card.img,
    tag_cardStars: card.stars,
    tag_cardOcurrences:
      " " + Math.floor((card.ocurrences / allDecks.length) * 100, 2) + " %",
    tag_cardOcurrencesInSides:
      " " +
      Math.floor(
        ((card.ocurrencesInSides - card.ocurrences) / allDecks.length) * 100,
        2,
      ) +
      " %",
  };

  for (const [id, value] of Object.entries(elementsToUpdate)) {
    const element = document.getElementById(id);
    if (element) {
      if (id === "tag_cardImg") {
        element.src = value;
      } else if (id === "tag_cardStars") {
        element.innerHTML = updateStars(card.stars); // Atualizar as estrelas
      } else if (id === "tag_cardText") {
        console.log(card.text);
        console.log(card.rulings);

        const textHtml = (
          "<b>" +
          card.name.toUpperCase() +
          "</b>" +
          ";" +
          card.text
        )
          .split(";")
          .map(
            (ruling) =>
              ruling
                .split(";") // Dividir a string em partes usando ";"
                .map((part) => `-> ${part.trim()}`) // Adicionar quebra de linha após cada parte
                .join(""), // Combinar as partes novamente
          )
          .join("<br>"); // Separar cada ruling com <br><br>

        if (rulingsChosenOption) {
          const rulingsHtml = card.rulings
            .map(
              (ruling) =>
                ruling
                  .split(";") // Dividir a string em partes usando ";"
                  .map((part) => `-> ${part.trim()}<br>`) // Adicionar quebra de linha após cada parte
                  .join(""), // Combinar as partes novamente
            )
            .join("<br>"); // Separar cada ruling com <br><br>

          element.innerHTML = `${textHtml}<br><br>${rulingsHtml}`;
        } else {
          element.innerHTML = `<b>${textHtml}</b>`;
        }
      } else {
        if (element.dataset && element.dataset.noprefix === "true") {
          element.textContent = String(value ?? "");
        } else {
          element.textContent = " " + value;
        }

        // Mirror support: copy to any element with data-mirror pointing to this id
        document
          .querySelectorAll(`[data-mirror="${id}"]`)
          .forEach((mirrorEl) => {
            mirrorEl.textContent = String(value ?? "");
          });
      }
    }
  }

  const el = document.getElementById("tag_cardStatus");
  el.innerHTML = cardStatus;
}

function updateSimilarCardsDOM(similarCardDetails, similarCards) {
  const similarCardsContainer = document.querySelector("#relatedCardsList");
  if (!similarCardsContainer) return;

  similarCardsContainer.innerHTML = "";

  similarCards.forEach((similarCard) => {
    const details = similarCardDetails.find(
      (card) => card.number === similarCard.idcard,
    );
    if (details) {
      const cardElement = document.createElement("div");
      cardElement.className =
        "fb-similar-card col-lg-2 col-md-3 col-sm-4 col-3 card__related__sidebar__view__item set-bg";
      cardElement.style.cursor = "pointer";
      cardElement.style.padding = "5px";
      cardElement.style["margin-bottom"] = "5px";
      cardElement.innerHTML = `
        <img class="card__details set-card-bg" src="${details.img}" alt="${details.name}" />
        <div class="card__related__info">
        </div>
      `;

      cardElement.addEventListener("click", () =>
        getCardDetails(details.number),
      );

      similarCardsContainer.appendChild(cardElement);
    }
  });
}

function updateRelatedDecks(relatedDecks) {
  const relatedDecksContainer = document.getElementById(
    "related-decks-container",
  );
  relatedDecksContainer.innerHTML = ""; // Limpa o conteúdo existente

  const fragment = document.createDocumentFragment(); // Fragmento para melhorar a performance

  relatedDecks.forEach((deck) => {
    let style, archetype, stars;

    stars = createListItem(
      "#ffffff",
      `<i style="color: #FFD700;" class="fa-solid fa-star"></i> ${deck.level}`,
    );

    // Definição do estilo
    switch (deck.style) {
      case "Agressivo":
        style = "#B22222";
        break;
      case "Equilibrado":
        style = "#FFD700";
        break;
      case "Controlador":
        style = "#1E90FF";
        break;
      default:
        style = "";
    }

    // Definição do arquétipo
    switch (deck.archetype) {
      case "Batalha":
        archetype = "#FF8C00";
        break;
      case "Santificação":
        archetype = "whitesmoke";
        break;
      case "Combo":
        archetype = "#800080";
        break;
      case "Tempestade":
        archetype = "#32CD32";
        break;
      case "Arsenal":
        archetype = "#A8B3B4";
        break;
      case "Supressão":
        archetype = "#000000";
        break;
      case "Aceleração":
        archetype = "#8B4513";
        break;
      default:
        archetype = "";
    }

    // Criação do contêiner de cada deck
    const deckElement = document.createElement("div");
    deckElement.className = "col-lg-2 col-md-3 col-sm-6 col-6";
    deckElement.style.cursor = "pointer";
    deckElement.style.display = "flex";
    deckElement.style.flexDirection = "column";
    deckElement.style.alignItems = "center";
    deckElement.style.textAlign = "center";
    // deckElement.style["margin-right"] = "10px";
    // deckElement.style["margin-left"] = "10px";
    deckElement.style["padding-right"] = "10px";
    deckElement.style["padding-left"] = "10px";
    deckElement.style["padding-bottom"] = "10px";
    deckElement.style.justifyContent = "center"; // Centraliza verticalmente (caso necessário)

    // Imagem do deck
    const imgElement = document.createElement("img");
    imgElement.src = deck.img;
    imgElement.alt = "Deck Image";
    imgElement.style.maxWidth = "100%";
    imgElement.style.height = "auto";
    // imgElement.style.border = "1px solid transparent";
    imgElement.style.borderImage =
      "linear-gradient(to right, " + style + " 50%, " + archetype + " 50%) 1";
    imgElement.style.overflow = "hidden"; // Garante que a borda arredondada funcione corretamente
    // imgElement.style.maxHeight = "150px";

    // Nome do deck
    const nameElement = document.createElement("h5");
    const nameLink = document.createElement("a");
    nameLink.href = "#";
    nameLink.textContent = deck.name;
    nameElement.style["font-family"] = '"Mulish", sans-serif';
    nameElement.style.fontSize = "12px"; // Tamanho da fonte reduzido
    nameElement.style["color"] = "#ffffff";
    nameElement.style.textAlign = "center"; // Garante alinhamento centralizado
    nameElement.style.width = "100%"; // Ajusta a largura para centralizar corretamente

    nameLink.style.color = "#fff"; // Definir a cor do texto do link como branco
    nameElement.appendChild(nameLink);

    // Lista de informações (estilo, arquétipo, estrelas)
    const ulElement = document.createElement("div");
    ulElement.style.display = "flex";
    ulElement.style.justifyContent = "space-between";
    ulElement.style.padding = "0";
    ulElement.style.listStyle = "none";
    // ulElement.style.width = "100%";
    ulElement.appendChild(stars);

    ulElement.style.justifyContent = "center"; // Centraliza os itens dentro da ul
    ulElement.style.width = "auto"; // Ajusta ao conteúdo

    // ulElement.appendChild(style);
    // ulElement.appendChild(archetype);

    // Adiciona os elementos ao contêiner do deck
    deckElement.appendChild(imgElement);
    deckElement.appendChild(nameElement);
    deckElement.appendChild(ulElement);

    // Adiciona o evento de clique
    deckElement.addEventListener("click", () => getDeckDetails(deck.number));

    // Adiciona ao fragmento
    fragment.appendChild(deckElement);
  });

  // Adiciona todo o fragmento ao DOM de uma vez
  relatedDecksContainer.appendChild(fragment);
}

function fillGauge(containerId, sections) {
  const container =
    typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;

  if (!container) return;

  // Always reset so repeated renders don't accumulate
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  (sections || []).forEach((section) => {
    if (section && section.rawWidth > 0) {
      const sectionDiv = document.createElement("div");
      sectionDiv.classList.add("gauge-section");
      sectionDiv.style.width = section.width + "%";
      sectionDiv.style.backgroundColor = section.backgroundColor;
      sectionDiv.style.color = section.color;

      const icon = document.createElement("i");
      // FontAwesome 6 uses "fa-solid" etc, but keep "fas" for backwards compatibility
      icon.classList.add("fas", section.icon);

      sectionDiv.appendChild(icon);
      fragment.appendChild(sectionDiv);
    }
  });

  container.appendChild(fragment);
}

async function loadFlavor(cardNumber) {
  try {
    const response = await fetch("data/flavor.json");
    const flavorData = await response.json();

    const flavor = flavorData.find((f) => f.cardNumber === cardNumber);

    const flavorContainer = document.getElementById("tag_cardFlavor");

    if (!flavorContainer) return;

    if (flavor) {
      flavorContainer.innerHTML = `
        <div class="fb-flavor-block">
          <div class="fb-verse"><i>${flavor.verse}</i></div><br>
          <div class="fb-poem">${flavor.poem}</div>
        </div>
      `;
    } else {
      flavorContainer.innerHTML = `<div class="fb-muted">Nenhuma referência disponível.</div>`;
    }
  } catch (error) {
    console.error("Erro ao carregar flavor.json:", error);
  }
}

// Função auxiliar para criar um item de lista com estilo
//para criar um item de lista com estilo
function createListItem(backgroundColor, innerHTMLContent) {
  const li = document.createElement("div");
  li.style.backgroundColor = backgroundColor;
  li.style.borderRadius = "10px"; // Bordas arredondadas
  li.style.padding = "5px 10px"; // Espaçamento interno ajustado
  li.style.margin = "5px"; // Espaçamento externo
  li.style.fontSize = "12px"; // Tamanho da fonte reduzido
  li.style.display = "flex";
  li.style.alignItems = "center";
  li.style.justifyContent = "center";
  li.style.fontWeight = "bold"; // Correção: sem o ponto antes
  li.innerHTML = innerHTMLContent;
  return li;
}

async function fetchRelatedCardsDetails(cardIds) {
  return allCards.filter((card) => cardIds.includes(card.number));
}

// Função para atualizar as estrelas
function updateStars(stars) {
  const resStars = parseFloat(stars); // Use parseFloat para manter a parte decimal

  const fullStars = Math.floor(resStars); // Parte inteira
  const halfStar = resStars % 1 >= 0.5; // Verifica se há uma meia estrela
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0); // Ajusta a contagem das estrelas vazias

  let innerHTML = "";

  // Adiciona estrelas cheias
  for (let i = 0; i < fullStars; i++) {
    innerHTML += '<a href="#"><i class="fa-solid fa-star"></i></a>';
  }

  // Adiciona meia estrela, se necessário
  if (halfStar) {
    innerHTML += '<a href="#"><i class="fa-solid fa-star-half-stroke"></i></a>';
  }

  // Adiciona estrelas vazias
  for (let i = 0; i < emptyStars; i++) {
    innerHTML += '<a href="#"><i class="fa-regular fa-star"></i></a>';
  }

  return (
    innerHTML + '<a href="#" style="font-size: 12px;"> ' + resStars + "</a>"
  );
}

function formatDate(dateString) {
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const date = new Date(dateString);
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  return `(${monthName}/${year})`;
}

document.addEventListener("DOMContentLoaded", () => {});

// v4: single panel section switching
const mainTabs = document.querySelectorAll("[data-fb-main-tab]");
const sections = document.querySelectorAll(".fb-panel-section");
const panelTitle = document.getElementById("fb-panel-title");

const titles = {
  info: "Informações",
  rulings: "Rulings",
  flavor: "Referências",
  "related-cards": "Cartas Relacionadas",
  "related-decks": "Melhores Decks",
};

function activateSection(key) {
  sections.forEach((sec) => {
    sec.classList.toggle("is-active", sec.dataset.section === key);
  });

  mainTabs.forEach((btn) => {
    const active = btn.dataset.fbMainTab === key;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  if (panelTitle) panelTitle.textContent = titles[key] || "";
}

mainTabs.forEach((btn) => {
  btn.addEventListener("click", () => activateSection(btn.dataset.fbMainTab));
});

activateSection("info");
