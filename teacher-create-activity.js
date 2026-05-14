const materialTypes = {
  link: {
    label: "Link externo",
    icon: "URL",
    placeholder: "https://...",
  },
  doc: {
    label: "Google Docs",
    icon: "DOC",
    placeholder: "https://docs.google.com/document/...",
  },
  upload: {
    label: "Upload simulado",
    icon: "PDF",
    placeholder: "Nome do arquivo ou referência simulada",
  },
  audio: {
    label: "Áudio",
    icon: "AUD",
    placeholder: "https://...",
  },
  video: {
    label: "Vídeo",
    icon: "VID",
    placeholder: "https://...",
  },
};

const form = document.querySelector("[data-assignment-form]");
const materialMenu = document.querySelector("[data-material-menu]");
const materialToggle = document.querySelector("[data-material-toggle]");
const materialOptions = document.querySelector("[data-material-options]");
const materialDraft = document.querySelector("[data-material-draft]");
const draftType = document.querySelector("[data-draft-type]");
const materialTitleInput = document.querySelector("[data-material-title]");
const materialUrlInput = document.querySelector("[data-material-url]");
const addMaterialButton = document.querySelector("[data-add-material]");
const cancelMaterialButton = document.querySelector("[data-cancel-material]");
const materialList = document.querySelector("[data-material-list]");
const emptyMaterials = document.querySelector("[data-empty-materials]");
const successMessage = document.querySelector("[data-success-message]");

const materials = [];
let selectedMaterialKind = "link";

function closeMaterialOptions() {
  materialOptions.classList.remove("active");
  materialToggle.setAttribute("aria-expanded", "false");
}

function openMaterialOptions() {
  materialOptions.classList.add("active");
  materialToggle.setAttribute("aria-expanded", "true");
}

function toggleMaterialOptions() {
  if (materialOptions.classList.contains("active")) {
    closeMaterialOptions();
    return;
  }

  openMaterialOptions();
}

function openMaterialDraft(kind) {
  selectedMaterialKind = kind;
  const materialType = materialTypes[kind];

  draftType.textContent = materialType.label;
  materialUrlInput.placeholder = materialType.placeholder;
  materialTitleInput.value = "";
  materialUrlInput.value = "";
  materialDraft.hidden = false;
  materialTitleInput.focus();
}

function closeMaterialDraft() {
  materialDraft.hidden = true;
  materialTitleInput.value = "";
  materialUrlInput.value = "";
}

function renderMaterials() {
  emptyMaterials.hidden = materials.length > 0;

  materialList.innerHTML = materials
    .map((material, index) => {
      const materialType = materialTypes[material.kind];

      return `
        <article class="material-item">
          <span class="material-item__icon material-item__icon--${material.kind}">
            ${materialType.icon}
          </span>
          <div class="material-item__content">
            <strong>${material.title}</strong>
            <span>${materialType.label}</span>
          </div>
          <button class="remove-material" type="button" data-remove-material="${index}">
            Remover
          </button>
        </article>
      `;
    })
    .join("");

  materialList.querySelectorAll("[data-remove-material]").forEach((button) => {
    button.addEventListener("click", () => {
      materials.splice(Number(button.dataset.removeMaterial), 1);
      renderMaterials();
    });
  });
}

function addMaterial() {
  const title = materialTitleInput.value.trim();
  const reference = materialUrlInput.value.trim();

  if (!title) {
    materialTitleInput.focus();
    return;
  }

  materials.push({
    title,
    reference,
    kind: selectedMaterialKind,
  });

  closeMaterialDraft();
  renderMaterials();
}

materialToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMaterialOptions();
});

materialOptions.addEventListener("click", (event) => {
  event.stopPropagation();
});

materialOptions.querySelectorAll("[data-material-kind]").forEach((option) => {
  option.addEventListener("click", () => {
    openMaterialDraft(option.dataset.materialKind);
    closeMaterialOptions();
  });
});

addMaterialButton.addEventListener("click", addMaterial);
cancelMaterialButton.addEventListener("click", closeMaterialDraft);

document.addEventListener("click", (event) => {
  if (!materialOptions.contains(event.target) && !materialToggle.contains(event.target)) {
    closeMaterialOptions();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMaterialOptions();
    closeMaterialDraft();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  successMessage.hidden = false;
  successMessage.textContent = "Atividade criada com sucesso";
  form.dataset.published = "true";

  window.setTimeout(() => {
    successMessage.hidden = true;
  }, 3200);
});

renderMaterials();
