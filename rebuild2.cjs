const fs = require('fs');

let code = fs.readFileSync('e:/precificacao/src/js/main.js', 'utf-8');

const anchorStart = 'function importItems(';
const anchorEnd = 'function createBackup() {';

const idxStart = code.lastIndexOf(anchorStart);
const idxEnd = code.lastIndexOf(anchorEnd);

if (idxStart === -1 || idxEnd === -1 || idxStart > idxEnd) {
    console.error("Anchors not found.", idxStart, "to", idxEnd);
    process.exit(1);
}

const robustReplacement = `function importItems(records, sourceType) {
  const items = records.map(mapImportedRecord).filter((item) => item.productName);

  if (!items.length) {
    showNotification(\`Nenhum item válido encontrado (\${sourceType}).\`, "warning");
    return;
  }

  updateActiveWorkbook((workbook) => {
    workbook.items.push(...items);
    return workbook;
  }, { versionLabel: \`Importação \${sourceType} (\${items.length} itens)\` });

  renderAll({ skipForms: false, skipHistory: false });
  showNotification(\`\${items.length} item(ns) importado(s) com sucesso!\`, "success");
}

function importItemsFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const records = parseDelimitedText(String(reader.result || ""));
    if (!records.length) {
      showNotification("CSV inválido ou vazio. Verifique se possui cabeçalho e dados.", "error");
      return;
    }
    // Para CSV vamos usar o mapeador legado por enquanto se quiser, ou mandar direto
    // Como foi pedido para XLSX vamos mandar pra ele também? Sim, o mapeador funciona com JSON genérico!
    handleImportedSpreadsheet(records);
  };
  reader.readAsText(file, "utf-8");
}

function importItemsFromXlsx(file) {
  if (!window.XLSX) {
    showNotification("Biblioteca XLSX não foi carregada. Tente novamente.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const workbookFile = window.XLSX.read(reader.result, { type: "array" });
      if (!workbookFile.SheetNames.length) {
        throw new Error("Arquivo não contém abas");
      }
      
      const firstSheet = workbookFile.Sheets[workbookFile.SheetNames[0]];
      // Sem mudar as chaves, mantendo os cabeçalhos literais para o usuário entender o modal
      const records = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      
      if (!records.length) {
        throw new Error("Aba principal está vazia");
      }
      
      handleImportedSpreadsheet(records);
    } catch (error) {
      showNotification(\`Erro ao importar XLSX: \${error.message}\`, "error");
      console.error(error);
    }
  };
  reader.readAsArrayBuffer(file);
}

`;

const newCode = code.slice(0, idxStart) + robustReplacement + code.slice(idxEnd);

// There might be another duplicate of "function importItems" above because the `replace_file_content` injected it earlier in the file.
// Let's remove the first instance of 'function importItems(' up to 'function importItemsFromFile'
const firstIdxStart = newCode.indexOf('function importItems(');
const firstIdxEnd = newCode.indexOf('function createBackup() {');
if (firstIdxStart !== newCode.lastIndexOf('function importItems(')) {
    console.log("Removing duplicate injected block...");
    const cleanCode = newCode.substring(0, firstIdxStart) + newCode.substring(newCode.lastIndexOf('function importItems('));
    fs.writeFileSync('e:/precificacao/src/js/main.js', cleanCode, 'utf-8');
} else {
    fs.writeFileSync('e:/precificacao/src/js/main.js', newCode, 'utf-8');
}

console.log("Rewrite successful.");
