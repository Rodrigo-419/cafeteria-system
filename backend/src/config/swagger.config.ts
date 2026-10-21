// Decision de publicar la documentacion interactiva (Swagger).
//
// En produccion NO se publica: expone el listado completo de rutas, sus DTO y
// el esquema de autenticacion, que es informacion util para un atacante. La
// decision se extrae a una funcion pura para poder probarla sin levantar la
// aplicacion ni depender de `main.ts` (que arranca el proceso).
export function debeHabilitarDocumentacion(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}
