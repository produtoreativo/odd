import {
  ContractRequirements,
  ContractRequirementsSchema,
  ObservationInput
} from './contract-schema.js';

/**
 * Validação semântica da saída do passo 2. Retorna uma lista de problemas;
 * lista vazia significa que a saída é coerente com a observação de entrada.
 * Segue o mesmo contrato de retorno do context-validator do passo 1.
 */
export function validateContractRequirements(
  contractRequirements: ContractRequirements | null,
  observation: ObservationInput | null
): string[] {
  if (!contractRequirements) {
    return ['Requisitos de contrato ausentes.'];
  }

  const parsed = ContractRequirementsSchema.safeParse(contractRequirements);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) => `Schema inválido em ${issue.path.join('.') || '<root>'}: ${issue.message}`
    );
  }

  const issues: string[] = [];
  const { contracts } = parsed.data;

  const observedCommands = new Set(
    (observation?.commandsDetected ?? []).map((command) => command.commandName)
  );
  const observedTouchPoints = new Set(observation?.touchPointsDetected ?? []);

  const seenCommands = new Set<string>();
  for (const contract of contracts) {
    if (seenCommands.has(contract.commandName)) {
      issues.push(`Command duplicado entre contratos: ${contract.commandName}`);
    }
    seenCommands.add(contract.commandName);

    if (observedCommands.size > 0 && !observedCommands.has(contract.commandName)) {
      issues.push(
        `Contrato cita command não observado na entrada: ${contract.commandName}`
      );
    }

    if (observedTouchPoints.size > 0 && !observedTouchPoints.has(contract.touchPointTitle)) {
      issues.push(
        `Contrato '${contract.commandName}' aponta para ponto de contato não observado: ${contract.touchPointTitle}`
      );
    }

    if (contract.minimalIdentifiers.length === 0) {
      issues.push(
        `Contrato '${contract.commandName}' não declarou nenhum identificador mínimo.`
      );
    }
  }

  // Todo command observado precisa virar contrato — é a essência do passo 2.
  for (const commandName of observedCommands) {
    if (!seenCommands.has(commandName)) {
      issues.push(`Command observado sem contrato correspondente: ${commandName}`);
    }
  }

  return issues;
}
