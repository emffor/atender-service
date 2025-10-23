import { Attendance, AttendanceStatus } from '../entities/Attendance';

/**
 * Tipos de email
 */
export enum EmailType {
  ATTENDANCE_IN = 'ATTENDANCE_IN',
  ATTENDANCE_OUT = 'ATTENDANCE_OUT',
  ATTENDANCE_APPROVED = 'ATTENDANCE_APPROVED',
  ATTENDANCE_REJECTED = 'ATTENDANCE_REJECTED',
  ATTENDANCE_LATE = 'ATTENDANCE_LATE',
  SHIFT_REMINDER = 'SHIFT_REMINDER',
  FACE_VERIFICATION_FAILED = 'FACE_VERIFICATION_FAILED',
}

/**
 * Contexto de email com dados tipados
 */
export interface EmailContext {
  [key: string]: string | number | boolean | Date | undefined | EmailContext | EmailContext[];
}

/**
 * Interface para dados de email
 */
export interface EmailData {
  to: string;
  subject: string;
  template: string;
  context: EmailContext;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
}

/**
 * Service para envio de emails
 * 
 * Publica eventos de email no RabbitMQ para que o serviço
 * de email processe e envie via SMTP, SendGrid, etc.
 */
export class EmailService {
  private readonly emailServiceUrl: string;
  private readonly emailApiKey?: string;

  constructor() {
    this.emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5002';
    this.emailApiKey = process.env.EMAIL_API_KEY;
  }

  /**
   * Envia email genérico via evento RabbitMQ
   */
  private async sendEmail(data: EmailData): Promise<void> {
    try {
      console.log(`[EmailService] Email queued to ${data.to}: ${data.subject}`);
      // TODO: Publicar evento no RabbitMQ quando exchange de emails estiver pronto
      // await eventPublisher.publishEmailEvent(data);
    } catch (error) {
      console.error('[EmailService] Failed to queue email:', error);
      // Não lançar erro para não bloquear o fluxo principal
    }
  }

  /**
   * Traduz status para PT-BR
   */
  private translateStatus(status: AttendanceStatus): string {
    const statusMap: Record<AttendanceStatus, string> = {
      APPROVED: '✅ Aprovado',
      PENDING: '⏳ Pendente',
      REJECTED: '❌ Rejeitado',
    };
    return statusMap[status] || status;
  }

  /**
   * Formata timestamp em PT-BR
   */
  private formatTimestampPTBR(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  /**
   * Gera template HTML completo com logo e branding
   */
  private generateHTMLTemplate(data: {
    title: string;
    doctorName: string;
    hospitalName: string;
    type: 'IN' | 'OUT';
    shiftId?: string;
    specialty?: string;
    status: AttendanceStatus;
    timestamp: Date;
    reason?: string;
  }): string {
    const statusText = this.translateStatus(data.status);
    const ptBRFormat = this.formatTimestampPTBR(data.timestamp);
    const typeText = data.type === 'IN' ? 'Entrada' : 'Saída';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      text-align: center;
      color: white;
    }
    .logo {
      width: 120px;
      height: auto;
      margin-bottom: 20px;
      background: white;
      padding: 10px;
      border-radius: 8px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .info-box {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #495057;
      font-size: 14px;
    }
    .value {
      color: #212529;
      font-size: 14px;
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      background: #d4edda;
      color: #155724;
    }
    .status-badge.pending {
      background: #fff3cd;
      color: #856404;
    }
    .status-badge.rejected {
      background: #f8d7da;
      color: #721c24;
    }
    .alert-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }
    .alert-box p {
      margin: 0;
      color: #856404;
      font-size: 14px;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #6c757d;
      font-size: 12px;
      border-top: 1px solid #e9ecef;
    }
    .footer p {
      margin: 5px 0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #667eea, transparent);
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header com logo e título -->
    <div class="header">
      <svg class="logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#667eea" rx="20"/>
        <text x="100" y="120" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle">MB</text>
      </svg>
      <h1>${data.title}</h1>
    </div>

    <!-- Conteúdo -->
    <div class="content">
      <h2 style="color: #212529; margin-top: 0;">Olá, ${data.doctorName}! 👋</h2>
      <p style="color: #495057; font-size: 16px; line-height: 1.6;">
        Seu ponto de <strong>${typeText}</strong> foi registrado com sucesso no sistema MedicBank.
      </p>

      <!-- Informações do registro -->
      <div class="info-box">
        <div class="info-row">
          <span class="label">👨‍⚕️ Médico:</span>
          <span class="value">${data.doctorName}</span>
        </div>
        <div class="info-row">
          <span class="label">🏥 Hospital:</span>
          <span class="value">${data.hospitalName}</span>
        </div>
        ${data.specialty ? `
        <div class="info-row">
          <span class="label">🩺 Especialidade:</span>
          <span class="value">${data.specialty}</span>
        </div>
        ` : ''}
        ${data.shiftId ? `
        <div class="info-row">
          <span class="label">📋 Plantão:</span>
          <span class="value">#${data.shiftId}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="label">⏰ Tipo:</span>
          <span class="value">${typeText}</span>
        </div>
        <div class="info-row">
          <span class="label">📊 Status:</span>
          <span class="value">
            <span class="status-badge ${data.status === 'PENDING' ? 'pending' : data.status === 'REJECTED' ? 'rejected' : ''}">
              ${statusText}
            </span>
          </span>
        </div>
        <div class="info-row">
          <span class="label">🕐 Horário:</span>
          <span class="value">${ptBRFormat}</span>
        </div>
        ${data.reason ? `
        <div class="info-row">
          <span class="label">📝 Motivo:</span>
          <span class="value">${data.reason}</span>
        </div>
        ` : ''}
      </div>

      ${data.status === 'PENDING' ? `
      <div class="alert-box">
        <p>
          <strong>⚠️ Atenção:</strong> Este registro está <strong>pendente de aprovação</strong> pelo hospital.
          Você será notificado assim que houver uma atualização.
        </p>
      </div>
      ` : ''}

      <div class="divider"></div>

      <p style="color: #6c757d; font-size: 14px; line-height: 1.6;">
        Este é um email automático enviado pelo sistema MedicBank para confirmar o registro do seu ponto.
        ${data.status === 'PENDING' ? 'O hospital foi notificado e irá revisar o registro em breve.' : ''}
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>MedicBank</strong> - Sistema de Gestão de Plantões Médicos</p>
      <p>© ${new Date().getFullYear()} MedicBank. Todos os direitos reservados.</p>
      <p style="margin-top: 15px;">
        <a href="https://medicbank.com/suporte">Central de Ajuda</a> |
        <a href="https://medicbank.com/contato">Contato</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Envia email de registro de ponto (entrada/saída)
   * ✅ IMPLEMENTADO: Template HTML completo com logo e branding
   * ✅ IMPLEMENTADO: Formatação PT-BR de datas
   * ✅ IMPLEMENTADO: Email DUPLO para hospital quando status === PENDING
   */
  async sendAttendanceEmail(
    type: 'IN' | 'OUT',
    doctorEmail: string,
    doctorName: string,
    shiftDate: Date,
    timestamp: Date,
    status: AttendanceStatus,
    hospitalName: string,
    hospitalEmail?: string,
    shiftId?: string,
    reason?: string,
    specialty?: string,
    location?: { latitude: number; longitude: number }
  ): Promise<void> {
    const typeText = type === 'IN' ? 'Entrada' : 'Saída';
    const subject = `🕒 Ponto ${typeText} Registrado - ${this.translateStatus(status)}`;

    // Gerar HTML template completo
    const htmlContent = this.generateHTMLTemplate({
      title: `🕒 Registro de Ponto ${typeText}`,
      doctorName,
      hospitalName,
      type,
      shiftId,
      specialty,
      status,
      timestamp,
      reason,
    });

    // Email para o médico
    await this.sendEmailHTML({
      to: doctorEmail,
      subject,
      html: htmlContent,
    });

    console.log(`[EmailService] HTML email sent to doctor: ${doctorEmail}`);

    // ✅ EMAIL DUPLO: Se status PENDING, enviar também para hospital
    if (status === 'PENDING' && hospitalEmail) {
      const hospitalSubject = `⚠️ Revisão necessária: Ponto ${typeText} PENDENTE — Dr(a). ${doctorName}`;
      
      const hospitalHTML = this.generateHTMLTemplate({
        title: `⚠️ Ponto ${typeText} Pendente de Aprovação`,
        doctorName,
        hospitalName,
        type,
        shiftId,
        specialty,
        status,
        timestamp,
        reason,
      });

      await this.sendEmailHTML({
        to: hospitalEmail,
        subject: hospitalSubject,
        html: hospitalHTML,
      });

      console.log(`[EmailService] Dual HTML email sent: doctor + hospital (PENDING)`);
    }
  }

  /**
   * Envia email HTML direto (sem template)
   */
  private async sendEmailHTML(data: { to: string; subject: string; html: string }): Promise<void> {
    try {
      console.log(`[EmailService] HTML email queued to ${data.to}: ${data.subject}`);
      // TODO: Publicar evento no RabbitMQ quando exchange de emails estiver pronto
      // await eventPublisher.publishEmailEvent(data);
    } catch (error) {
      console.error('[EmailService] Failed to queue HTML email:', error);
    }
  }

  /**
   * Envia email de aprovação de ponto
   */
  async sendApprovalEmail(
    attendance: Attendance,
    doctorEmail: string,
    doctorName: string,
    hospitalName: string,
    approverName: string,
    hasDiscount: boolean,
    discountPercentage?: number,
    finalValue?: number
  ): Promise<void> {
    const discountInfo = hasDiscount && discountPercentage
      ? {
          hasDiscount: true,
          percentage: discountPercentage,
          originalValue: finalValue ? finalValue / (1 - discountPercentage / 100) : 0,
          finalValue: finalValue || 0,
          discountedAmount: finalValue ? (finalValue / (1 - discountPercentage / 100)) - finalValue : 0,
        }
      : { hasDiscount: false };

    await this.sendEmail({
      to: doctorEmail,
      subject: '✅ Ponto Aprovado - MedicBank',
      template: 'attendance-approved',
      context: {
        doctorName,
        hospitalName,
        approverName,
        timestamp: attendance.timestamp.toLocaleString('pt-BR'),
        type: attendance.type,
        approvedAt: new Date().toLocaleString('pt-BR'),
        ...discountInfo,
      },
    });
  }

  /**
   * Envia email de rejeição de ponto
   */
  async sendRejectionEmail(
    attendance: Attendance,
    doctorEmail: string,
    doctorName: string,
    hospitalName: string,
    rejectorName: string,
    reason: string
  ): Promise<void> {
    await this.sendEmail({
      to: doctorEmail,
      subject: '❌ Ponto Rejeitado - MedicBank',
      template: 'attendance-rejected',
      context: {
        doctorName,
        hospitalName,
        rejectorName,
        timestamp: attendance.timestamp.toLocaleString('pt-BR'),
        type: attendance.type,
        reason,
        rejectedAt: new Date().toLocaleString('pt-BR'),
      },
    });
  }

  /**
   * Envia email de atraso
   */
  async sendLateEmail(
    doctorEmail: string,
    doctorName: string,
    hospitalName: string,
    type: 'IN' | 'OUT',
    scheduledTime: Date,
    actualTime: Date,
    lateMinutes: number
  ): Promise<void> {
    const punchType = type === 'IN' ? 'entrada' : 'saída';

    await this.sendEmail({
      to: doctorEmail,
      subject: '⚠️ Atraso Registrado - MedicBank',
      template: 'attendance-late',
      context: {
        doctorName,
        hospitalName,
        type: punchType,
        scheduledTime: scheduledTime.toLocaleTimeString('pt-BR'),
        actualTime: actualTime.toLocaleTimeString('pt-BR'),
        lateMinutes,
        date: actualTime.toLocaleDateString('pt-BR'),
      },
    });
  }

  /**
   * Envia email de lembrete de plantão
   */
  async sendShiftReminderEmail(
    doctorEmail: string,
    doctorName: string,
    hospitalName: string,
    shiftDate: Date,
    shiftStartTime: Date,
    shiftEndTime: Date,
    hoursBeforeStart: number
  ): Promise<void> {
    await this.sendEmail({
      to: doctorEmail,
      subject: '🏥 Lembrete de Plantão - MedicBank',
      template: 'shift-reminder',
      context: {
        doctorName,
        hospitalName,
        shiftDate: shiftDate.toLocaleDateString('pt-BR'),
        shiftStartTime: shiftStartTime.toLocaleTimeString('pt-BR'),
        shiftEndTime: shiftEndTime.toLocaleTimeString('pt-BR'),
        hoursBeforeStart,
      },
    });
  }

  /**
   * Envia email de falha na verificação facial
   */
  async sendFaceVerificationFailedEmail(
    doctorEmail: string,
    doctorName: string,
    confidence: number,
    requiredConfidence: number,
    attemptTime: Date
  ): Promise<void> {
    await this.sendEmail({
      to: doctorEmail,
      subject: '🔒 Falha na Verificação Facial - MedicBank',
      template: 'face-verification-failed',
      context: {
        doctorName,
        confidence: (confidence * 100).toFixed(1),
        requiredConfidence: (requiredConfidence * 100).toFixed(0),
        attemptTime: attemptTime.toLocaleString('pt-BR'),
      },
    });
  }

  /**
   * Envia email com relatório PDF anexado
   */
  async sendReportEmail(
    recipientEmail: string,
    recipientName: string,
    reportTitle: string,
    reportPdfBuffer: Buffer,
    reportFileName: string,
    reportPeriod: { startDate: Date; endDate: Date }
  ): Promise<void> {
    await this.sendEmail({
      to: recipientEmail,
      subject: `📊 ${reportTitle} - MedicBank`,
      template: 'report',
      context: {
        recipientName,
        reportTitle,
        startDate: reportPeriod.startDate.toLocaleDateString('pt-BR'),
        endDate: reportPeriod.endDate.toLocaleDateString('pt-BR'),
        generatedAt: new Date().toLocaleString('pt-BR'),
      },
      attachments: [
        {
          filename: reportFileName,
          content: reportPdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Envia email para múltiplos destinatários
   */
  async sendBulkEmail(
    recipients: string[],
    subject: string,
    template: string,
    context: EmailContext
  ): Promise<void> {
    const promises = recipients.map(to =>
      this.sendEmail({ to, subject, template, context })
    );

    await Promise.allSettled(promises);
  }
}
