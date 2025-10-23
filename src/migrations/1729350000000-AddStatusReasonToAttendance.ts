import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Migration: Adicionar coluna statusReason à tabela attendance
 * 
 * Propósito:
 * - Separar o motivo gerado pelo SISTEMA (statusReason) do motivo fornecido pelo USUÁRIO (reason)
 * - Melhorar rastreabilidade e clareza sobre por que um ponto ficou PENDING ou foi REJECTED
 * 
 * Exemplos de statusReason:
 * - "Fora da área geográfica permitida"
 * - "Check-out tardio - requer aprovação manual"
 * - "Coordenadas suspeitas detectadas pelo antifraude"
 * - "Médico excluído da verificação de área"
 * 
 * Data: 2025-10-19
 */
export class AddStatusReasonToAttendance1729350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "attendance",
      new TableColumn({
        name: "statusReason",
        type: "text",
        isNullable: true,
        comment: "Motivo gerado automaticamente pelo sistema para o status do ponto (PENDING/APPROVED/REJECTED)"
      })
    );

    console.log("✅ Coluna 'statusReason' adicionada à tabela 'attendance'");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("attendance", "statusReason");
    console.log("⏪ Coluna 'statusReason' removida da tabela 'attendance'");
  }
}
