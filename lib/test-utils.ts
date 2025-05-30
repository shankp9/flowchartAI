import { sanitizeMermaidCode } from "./utils"

// Test function for the specific sequence diagram issue
export function testSequenceDiagramFix() {
  const problematicCode = `sequenceDiagram
    Client ->> API: Request to authenticate
    API -->> Database: Check
    Database -->> API: authentication result
    -->> Client: Send authentication result`

  console.log("Original code:")
  console.log(problematicCode)
  console.log("\nFixed code:")
  console.log(sanitizeMermaidCode(problematicCode))
}

// Expected output should be:
// sequenceDiagram
//     Client ->> API: Request to authenticate
//     API -->> Database: Check
//     Database -->> API: authentication result
//     API -->> Client: Send authentication result
