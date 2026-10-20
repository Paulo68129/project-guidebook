/**
 * Gera o payload PIX EMV QR Code no padrão do Banco Central do Brasil.
 * Referência: https://www.bcb.gov.br/estabilidadefinanceira/pix
 */
import QRCode from "qrcode";

// Dados fixos do beneficiário
const PIX_CONFIG = {
  nome: "Paulo Roberto Silva de Oliveira Junior", // Nome completo (usado apenas internamente)
  nomeCurto: "PIZZASTOCKAI", // Nome exibido no QR code e na tela (máx 25 chars)
  nomeExibicao: "PizzaStockAI", // Nome exibido para o cliente na tela
  chave: "09406790785", // Chave PIX (vai completa no QR code)
  cidade: "SAO PAULO", // Limite de 15 caracteres
};

/**
 * Mascara uma chave PIX CPF para exibição segura.
 * Ex: "09406790785" → "***.067.907-**"
 */
export function maskPixChave(chave: string): string {
  const digits = chave.replace(/\D/g, "");
  if (digits.length === 11) {
    // CPF: ***.067.907-**
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  // Outros tipos: mascara o meio
  if (digits.length <= 8) return `***${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
}

/**
 * Mascara um telefone para exibição segura.
 * Ex: "(21) 99319-1234" → "(21) 99319-****"
 */
export function maskTelefone(telefone: string): string {
  const digits = telefone.replace(/\D/g, "");
  const formatted = telefone.replace(/\d/g, (d, i) => {
    if (i >= digits.length - 4) return "*";
    return d;
  });
  return formatted;
}

/**
 * Adiciona um campo GV (Generic Value) ao payload.
 * Formato: TLV (Tag-Length-Value)
 */
function addField(builder: string, tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${builder}${tag}${len}${value}`;
}

/**
 * Gera um TXID aleatório de 14 caracteres para a transação.
 */
function generateTxId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let txid = '';
  for (let i = 0; i < 14; i++) {
    txid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return txid;
}

/**
 * TXID estável derivado do id do pedido: o QR Code não muda a cada atualização da tela
 * e a loja consegue identificar o pagamento pelo identificador no extrato.
 */
export function pixTxidFromOrderId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 25);
}

/**
 * Gera o payload PIX completo para um valor dado.
 * @param valor - Valor da transação em reais (número)
 * @param txid - Identificador alfanumérico (até 25 caracteres). Aleatório se omitido.
 * @returns String do payload PIX EMV QR Code
 */
export function generatePixPayload(valor: number, txid?: string): string {
  let payload = "";

  // 00: Payload Format Indicator
  payload = addField(payload, "00", "01");

  // 01: Point of Initiation Method (11 = Static QR)
  payload = addField(payload, "01", "11");

  // 26: Merchant Account Information
  let accountInfo = "";
  accountInfo = addField(accountInfo, "00", "BR.GOV.BCB.PIX");
  accountInfo = addField(accountInfo, "01", PIX_CONFIG.chave);
  payload = addField(payload, "26", accountInfo);

  // 52: Merchant Category Code
  payload = addField(payload, "52", "0000");

  // 53: Transaction Currency (BRL = 986)
  payload = addField(payload, "53", "986");

  // 54: Transaction Amount (opcional, mas incluído para fixar o valor)
  payload = addField(payload, "54", valor.toFixed(2));

  // 58: Country Code
  payload = addField(payload, "58", "BR");

  // 59: Merchant Name (máximo 25 caracteres)
  payload = addField(payload, "59", PIX_CONFIG.nomeCurto);

  // 60: Merchant City (máximo 15 caracteres)
  payload = addField(payload, "60", PIX_CONFIG.cidade);

  // 62: Additional Data Field - TXID
  let additional = "";
  const cleanTxid = (txid ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
  additional = addField(additional, "05", cleanTxid || generateTxId());
  payload = addField(payload, "62", additional);

  // 63: CRC16-CCITT - IMPORTANT: o CRC deve incluir "6304" no cálculo
  payload = `${payload}6304`;
  const crc = calculateCRC16(payload);
  payload = `${payload}${crc}`;

  return payload;
}

/**
 * Calcula o CRC16-CCITT (ISO 13239) para o payload PIX.
 * Polinômio: 0x1021, valor inicial: 0xFFFF
 */
function calculateCRC16(data: string): string {
  let crc = 0xFFFF;

  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    crc ^= (ch << 8);

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Retorna a configuração PIX para exibição (dados mascarados).
 */
export function getPixConfig() {
  return {
    nome: PIX_CONFIG.nomeExibicao,
    chave: maskPixChave(PIX_CONFIG.chave),
  };
}

/**
 * Gera a imagem do QR Code. Se o canvas falhar (navegadores antigos, bloqueios),
 * gera um SVG puro como alternativa.
 */
export async function gerarQrCodePix(payload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: "M" });
  } catch {
    const svg = await QRCode.toString(payload, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}

/**
 * Retorna a configuração PIX completa (não mascarada, para QR code).
 */
export function getPixConfigRaw() {
  return {
    nome: PIX_CONFIG.nome,
    chave: PIX_CONFIG.chave,
  };
}
