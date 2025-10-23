/**
 * Resultado do upload de foto
 */
export interface PhotoUploadResult {
  success: boolean;
  key: string | null;
  error?: string;
}

/**
 * Serviço especializado em upload de fotos (Event-Driven Version)
 * Responsabilidade Única: Gerenciar fotos de attendance
 */
export class AttendancePhotoService {
  
  /**
   * Faz upload da foto (versão simplificada)
   */
  async uploadPhoto(
    photo: string | undefined,
    shiftId: string,
    doctorId: string
  ): Promise<PhotoUploadResult> {
    if (!photo) {
      return {
        success: true,
        key: null,
      };
    }
    
    // Versão simplificada - gera uma key fake
    const timestamp = Date.now();
    const key = `attendance-photos/${shiftId}/${doctorId}/${timestamp}.jpg`;
    
    // TODO: Implementar upload real para S3
    console.log(`📸 [PHOTO] Upload simulado: ${key}`);
    
    return {
      success: true,
      key,
    };
  }
  
  /**
   * Gera URL assinada para foto
   */
  generateSignedUrl(photoS3Key: string | null): string | null {
    if (!photoS3Key) {
      return null;
    }
    
    // Versão simplificada - gera URL fake
    return `https://fake-s3-bucket.s3.amazonaws.com/${photoS3Key}?expires=3600`;
  }
}