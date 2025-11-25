export enum WhatsappStatus {
  CONNECTING = 'CONNECTING', // Iniciando / Tentando conectar
  QR_CODE = 'QR_CODE_READY', // Aguardando leitura do QR
  CONNECTED = 'CONNECTED', // Logado e pronto para uso
  DISCONNECTED = 'DISCONNECTED', // Caiu ou foi desconectado
}
