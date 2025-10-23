/**
 * Dados da unidade de saúde para validação geográfica
 */
export interface HealthUnitData {
  id: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  polygonAreas?: Array<{
    name: string;
    type: string;
    coordinates: Array<[number, number]>;
  }>;
}

/**
 * Resultado da verificação de coordenadas
 */
export interface CoordinateValidationResult {
  isValid: boolean;
  latDecimals: number;
  lngDecimals: number;
  trustScore: number;
  confidence: "high" | "medium" | "low";
  flags: string[];
  severity?: "error" | "warning" | "info";
  reason?: string;
}

/**
 * Resultado da verificação de área geográfica
 */
export interface GeofenceValidationResult {
  withinAllowedArea: boolean;
  hasPolygons: boolean;
  isWithinPolygon?: boolean;
  isNearPolygon?: boolean;
  matchedAreas?: Array<{ name: string; type: string; description?: string }>;
  distanceToNearestArea?: number;
  reason: string;
}

/**
 * Informações de timezone
 */
export interface TimezoneInfo {
  tz: string;
  tzOffsetMin: number;
  localTimestamp: Date;
  utcTimestamp: Date;
}

/**
 * Serviço especializado em validações geográficas (Event-Driven Version)
 * Responsabilidade Única: Geolocalização e geofencing
 */
export class AttendanceGeolocationService {
  
  /**
   * Valida coordenadas GPS para detecção de fraude
   */
  validateCoordinates(
    latitude: number,
    longitude: number
  ): CoordinateValidationResult {
    const latDecimals = this.countDecimals(latitude);
    const lngDecimals = this.countDecimals(longitude);
    
    let trustScore = 100;
    let flags: string[] = [];
    let confidence: "high" | "medium" | "low" = "high";
    
    // Verificações de qualidade das coordenadas
    if (latDecimals < 4 || lngDecimals < 4) {
      trustScore -= 30;
      flags.push("Precisão baixa");
      confidence = "low";
    }
    
    if (latitude === 0 && longitude === 0) {
      trustScore = 0;
      flags.push("Coordenadas zeradas");
      confidence = "low";
    }
    
    const isValid = trustScore >= 70;
    
    return {
      isValid,
      latDecimals,
      lngDecimals,
      trustScore,
      confidence,
      flags,
      severity: isValid ? "info" : "warning",
      reason: flags.length > 0 ? flags.join(", ") : undefined,
    };
  }

  /**
   * Valida geofence (versão simplificada)
   */
  validateGeofence(
    latitude: number,
    longitude: number,
    healthUnit: HealthUnitData
  ): GeofenceValidationResult {
    // Versão simplificada - assume área permitida se healthUnit existe
    const hasPolygons = (healthUnit?.polygonAreas?.length ?? 0) > 0;
    
    if (!hasPolygons) {
      return {
        withinAllowedArea: false,
        hasPolygons: false,
        reason: "HealthUnit sem áreas demarcadas",
      };
    }
    
    // Simulação simplificada - na versão real faria cálculos de polígono
    return {
      withinAllowedArea: true,
      hasPolygons: true,
      isWithinPolygon: true,
      matchedAreas: [{ name: "Área Principal", type: "polygon" }],
      distanceToNearestArea: 0,
      reason: "Dentro da área permitida",
    };
  }

  /**
   * Obter informações de timezone
   */
  getTimezoneInfo(latitude: number, longitude: number): TimezoneInfo {
    // Versão simplificada - assume timezone do Brasil
    const now = new Date();
    const tz = "America/Sao_Paulo";
    const tzOffsetMin = -180; // UTC-3

    return {
      tz,
      tzOffsetMin,
      localTimestamp: new Date(now.getTime() + (tzOffsetMin * 60 * 1000)),
      utcTimestamp: now,
    };
  }

  /**
   * Conta casas decimais de um número
   */
  private countDecimals(value: number): number {
    if (Math.floor(value) === value) return 0;
    const str = value.toString();
    if (str.indexOf(".") !== -1 && str.indexOf("e-") === -1) {
      return str.split(".")[1].length;
    } else if (str.indexOf("e-") !== -1) {
      const parts = str.split("e-");
      return parseInt(parts[1], 10);
    }
    return 0;
  }
}