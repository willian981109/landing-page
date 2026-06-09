(function initializeMaterialFiles(global) {
  const uploadRules = {
    pdf: {
      accept: ".pdf,application/pdf",
      extensions: [".pdf"],
      maxSize: 15 * 1024 * 1024,
      help: "Arquivo PDF de até 15 MB.",
    },
    docs: {
      accept: ".doc,.docx,.odt",
      extensions: [".doc", ".docx", ".odt"],
      maxSize: 15 * 1024 * 1024,
      help: "Arquivo DOC, DOCX ou ODT de até 15 MB.",
    },
    document: {
      accept: ".doc,.docx,.odt",
      extensions: [".doc", ".docx", ".odt"],
      maxSize: 15 * 1024 * 1024,
      help: "Arquivo DOC, DOCX ou ODT de até 15 MB.",
    },
    audio: {
      accept: ".mp3,.wav,.ogg,.m4a,audio/*",
      extensions: [".mp3", ".wav", ".ogg", ".m4a"],
      maxSize: 30 * 1024 * 1024,
      help: "Arquivo MP3, WAV, OGG ou M4A de até 30 MB.",
    },
    video: {
      accept: ".mp4,.mov,.webm,.avi,video/*",
      extensions: [".mp4", ".mov", ".webm", ".avi"],
      maxSize: 200 * 1024 * 1024,
      help: "Arquivo MP4, MOV, WEBM ou AVI de até 200 MB.",
    },
  };

  function getExtension(fileName) {
    const name = String(fileName || "").toLowerCase();
    const dotIndex = name.lastIndexOf(".");
    return dotIndex >= 0 ? name.slice(dotIndex) : "";
  }

  function getRule(materialType) {
    return uploadRules[materialType] || null;
  }

  function validateFile(file, materialType) {
    const rule = getRule(materialType);

    if (!rule) {
      throw new Error("Este tipo de material não aceita arquivo.");
    }

    if (!file) {
      throw new Error("Selecione um arquivo.");
    }

    if (!rule.extensions.includes(getExtension(file.name))) {
      throw new Error(`Formato inválido. Use apenas: ${rule.extensions.join(", ")}.`);
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("O arquivo selecionado está vazio.");
    }

    if (file.size > rule.maxSize) {
      throw new Error(`O arquivo excede o limite de ${Math.round(rule.maxSize / 1024 / 1024)} MB.`);
    }

    return file;
  }

  function formatFileSize(size) {
    const bytes = Number(size) || 0;

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function readApiResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível concluir o envio do arquivo.");
    }

    return data;
  }

  async function uploadFile(file, materialType, token) {
    validateFile(file, materialType);

    const authorizationResponse = await fetch("/uploads/sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        material_type: materialType,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      }),
    });
    const authorization = await readApiResponse(authorizationResponse);
    const body = new FormData();
    const normalizedFile = new File([file], file.name, {
      type: authorization.mime_type,
      lastModified: file.lastModified,
    });
    body.append("cacheControl", "3600");
    body.append("", normalizedFile);

    try {
      const uploadResponse = await fetch(authorization.signed_url, {
        method: "PUT",
        headers: {
          "x-upsert": "false",
        },
        body,
      });

      if (!uploadResponse.ok) {
        throw new Error("O arquivo não pôde ser enviado ao armazenamento.");
      }

      return {
        file_id: authorization.id,
        file_name: authorization.file_name,
        mime_type: authorization.mime_type,
        size_bytes: authorization.size_bytes,
      };
    } catch (error) {
      await cancelUpload(authorization.id, token).catch(() => {});
      throw error;
    }
  }

  async function cancelUpload(fileId, token) {
    if (!fileId || !token) {
      return;
    }

    await fetch(`/uploads/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function openFile(fileId, token, { download = false } = {}) {
    if (!fileId || !token) {
      throw new Error("Não foi possível validar o acesso ao arquivo.");
    }

    const targetWindow = global.open("", "_blank");

    try {
      const response = await fetch(
        `/files/${encodeURIComponent(fileId)}/access${download ? "?download=1" : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const access = await readApiResponse(response);

      if (targetWindow) {
        targetWindow.opener = null;
        targetWindow.location.replace(access.url);
      } else {
        global.location.href = access.url;
      }
    } catch (error) {
      targetWindow?.close();
      throw error;
    }
  }

  global.EnglishStudioFiles = {
    cancelUpload,
    formatFileSize,
    getRule,
    openFile,
    uploadFile,
    validateFile,
  };
})(window);
