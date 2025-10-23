# 🏥 Attendance Service - MedicBank

Microserviço responsável pelo gerenciamento de pontos (check-in/check-out) de médicos na plataforma MedicBank. Implementa Design Patterns profissionais, validação GPS anti-fraude, controle de descontos e aprovação automática baseada em regras de negócio.

---

## 🧭 Sumário

- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)  
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Design Patterns](#design-patterns)
- [Testes](#testes)
- [Docker](#docker)
- [Variáveis de Ambiente](#variáveis-de-ambiente)

---

## 🏗️ Arquitetura

O Attendance Service foi construído seguindo **Arquitetura em Camadas** com **Design Patterns**:

```
┌─────────────────────────────────────────────┐
│                Controllers                   │  ← HTTP REST API
├─────────────────────────────────────────────┤
│                 Facades                     │  ← Orchestração
├─────────────────────────────────────────────┤
│              Services Layer                 │  ← Lógica de Negócio
│  • ValidationService                       │
│  • GeolocationService                      │
│  • DiscountService                         │
│  • PhotoService                            │
├─────────────────────────────────────────────┤
│            Repository Layer                 │  ← Acesso a Dados
├─────────────────────────────────────────────┤
│              Database (PostgreSQL)          │  ← Persistência
└─────────────────────────────────────────────┘
```

### Design Patterns Implementados

- **🎯 Facade Pattern**: Simplifica interface complexa
- **📦 Repository Pattern**: Abstrai acesso aos dados
- **📋 DTO Pattern**: Validação e transferência de dados
- **🔄 Strategy Pattern**: Validações plugáveis
- **🏭 Factory Pattern**: Criação de objetos
- **🧱 SOLID Principles**: Código limpo e manutenível

---

## 🧰 Tecnologias

- **Node.js** 22+ com **TypeScript** 5+
- **Express** - Framework web minimalista
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados principal
- **Redis** - Cache (opcional)
- **JWT** - Autenticação
- **AWS S3** - Armazenamento de fotos
- **Jest** - Framework de testes
- **Docker** - Containerização
- **class-validator** - Validação de DTOs

---

## ⚡ Instalação

### Pré-requisitos

- Node.js 22+
- PostgreSQL 13+
- Redis (opcional)
- AWS S3 configurado

### 1. Clonar e instalar

```bash
# Navegar para o microserviço
cd services/attendance-service

# Instalar dependências
npm install

# Compilar TypeScript
npm run build
```

### 2. Configurar banco de dados

```bash
# Criar banco de dados
createdb medicbank_attendance

# Rodar migrações (quando disponíveis)
npm run migration:run
```

---

## ⚙️ Configuração

### Copiar arquivo de exemplo

```bash
cp .env.example .env
```

### Configurar variáveis principais

```bash
# Servidor
PORT=3003
NODE_ENV=development

# Banco de dados
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=medicbank_user
DATABASE_PASSWORD=sua_senha_aqui
DATABASE_NAME=medicbank_attendance

# JWT
JWT_SECRET=troque_por_uma_chave_segura_de_attendance
JWT_EXPIRES_IN=24h

# AWS S3
AWS_ACCESS_KEY_ID=sua_aws_access_key
AWS_SECRET_ACCESS_KEY=sua_aws_secret_key
AWS_S3_BUCKET_NAME=medicbank-attendance-photos

# Outros microserviços
USER_SERVICE_URL=http://localhost:3001
SHIFT_SERVICE_URL=http://localhost:3002
```

---

## 🚀 Uso

### Desenvolvimento

```bash
# Modo desenvolvimento com hot reload
npm run dev

# Em modo debug
DEBUG=attendance:* npm run dev
```

### Produção

```bash
# Build e start
npm run build
npm start
```

### Health Check

```bash
curl http://localhost:3003/health
```

---

## 📊 API Endpoints

### **Autenticação**
Todas as rotas requerem **Bearer JWT Token**.

### **Core Endpoints**

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/v1/attendance` | Registrar ponto |
| `GET` | `/api/v1/attendance` | Listar attendances |
| `GET` | `/api/v1/attendance/:id` | Obter por ID |
| `PATCH` | `/api/v1/attendance/:id/approve` | Aprovar |
| `PATCH` | `/api/v1/attendance/:id/reject` | Rejeitar |

### **Endpoints Auxiliares**

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/v1/attendance/shift/:shiftId/pending` | Pendentes por shift |
| `GET` | `/api/v1/attendance/doctor/:doctorId/open-punches` | Pontos em aberto |
| `GET` | `/api/v1/attendance/stats/hospital/:hospitalId` | Estatísticas |
| `GET` | `/api/v1/attendance/docs` | Documentação |

### **Exemplos de Uso**

#### 1. Registrar Check-in

```bash
curl -X POST http://localhost:3003/api/v1/attendance \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "doctorId=doctor-uuid" \
  -F "shiftId=shift-uuid" \
  -F "type=IN" \
  -F "latitude=-23.5505" \
  -F "longitude=-46.6333" \
  -F "photo=@selfie.jpg" \
  -F "reason=Check-in normal"
```

#### 2. Listar Attendances

```bash
curl -X GET "http://localhost:3003/api/v1/attendance?page=1&limit=10&status=PENDING" \
  -H "Authorization: Bearer SEU_JWT_TOKEN"
```

#### 3. Aprovar com Desconto

```bash
curl -X PATCH http://localhost:3003/api/v1/attendance/att-uuid/approve \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applyDiscount": true,
    "reason": "Aprovado com desconto por atraso"
  }'
```

---

## 🎯 Design Patterns

### 1. **Facade Pattern**

```typescript
// Simplifica operações complexas
const result = await attendanceFacade.recordAttendance(dto);

// Internamente orquestra:
// - Validação de negócio
// - Verificação GPS
// - Cálculo de desconto  
// - Upload de foto
// - Persistência
// - Atualização de shift
```

### 2. **Repository Pattern**

```typescript
// Interface abstrata
interface IAttendanceRepository {
  findById(id: string): Promise<Attendance | null>;
  save(attendance: Attendance): Promise<Attendance>;
}

// Implementação concreta
class AttendanceRepository implements IAttendanceRepository {
  // TypeORM implementation
}
```

### 3. **DTO Pattern**

```typescript
// Validação automática
export class CreateAttendanceDTO {
  @IsNotEmpty()
  @IsString()
  doctorId!: string;

  @IsNumber()
  @Min(-90) @Max(90)
  latitude!: number;

  // Validações automáticas com class-validator
}
```

### 4. **Strategy Pattern**

```typescript
// Validações plugáveis
const strategies = [
  new CoordinateValidationStrategy(),
  new GeofenceValidationStrategy(),
  new TimeWindowValidationStrategy(),
];

const result = await compositeStrategy.validate(context);
```

---

## 🧪 Testes

### Rodar todos os testes

```bash
npm test
```

### Testes com coverage

```bash
npm run test:coverage
```

### Testes unitários por serviço

```bash
# AttendanceDiscountService
npm test -- AttendanceDiscountService

# AttendanceGeolocationService  
npm test -- AttendanceGeolocationService

# AttendanceValidationService
npm test -- AttendanceValidationService
```

### Testes de integração

```bash
# AttendanceFacade integration
npm test -- AttendanceFacade.integration
```

### Estrutura de Testes

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── facades/
│   ├── integration/
│   └── fixtures/
```

---

## 🐳 Docker

### Development

```bash
# Build da imagem
docker build --target development -t attendance-service:dev .

# Rodar container
docker run -p 3003:3003 --env-file .env attendance-service:dev
```

### Production

```bash
# Build produção
docker build --target production -t attendance-service:prod .

# Rodar com docker-compose
docker-compose up -d attendance-service
```

### Docker Compose (exemplo)

```yaml
version: '3.8'
services:
  attendance-service:
    build: ./services/attendance-service
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=production
      - DATABASE_HOST=postgres
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: medicbank_attendance
      POSTGRES_USER: medicbank_user
      POSTGRES_PASSWORD: password

  redis:
    image: redis:7-alpine
```

---

## 🔐 Variáveis de Ambiente

### Server

```bash
PORT=3003                          # Porta do serviço
NODE_ENV=development               # Ambiente
CORS_ORIGINS=http://localhost:3000 # CORS origins
```

### Database

```bash
DATABASE_HOST=localhost            # Host PostgreSQL
DATABASE_PORT=5432                 # Porta PostgreSQL
DATABASE_USERNAME=medicbank_user   # Usuário do banco
DATABASE_PASSWORD=password         # Senha do banco  
DATABASE_NAME=medicbank_attendance # Nome do banco
DATABASE_SSL=false                 # SSL connection
```

### Authentication

```bash
JWT_SECRET=chave_super_segura      # Chave JWT (min 32 chars)
JWT_EXPIRES_IN=24h                 # Expiração do token
```

### AWS S3

```bash
AWS_ACCESS_KEY_ID=AKIA...         # AWS Access Key
AWS_SECRET_ACCESS_KEY=secret...   # AWS Secret Key
AWS_REGION=us-east-1              # AWS Region
AWS_S3_BUCKET_NAME=bucket-name    # S3 Bucket para fotos
```

### Microservices

```bash
USER_SERVICE_URL=http://localhost:3001     # User Service
SHIFT_SERVICE_URL=http://localhost:3002    # Shift Service  
HOSPITAL_SERVICE_URL=http://localhost:3004 # Hospital Service
```

### Business Rules

```bash
GPS_ACCURACY_THRESHOLD=10          # Precisão GPS mínima (metros)
GEOFENCE_BUFFER_METERS=5          # Buffer para geofence
ATTENDANCE_TOLERANCE_MINUTES=15    # Tolerância para atraso
MAX_DISCOUNT_PERCENTAGE=50         # Desconto máximo (%)
AUTO_APPROVE_WINDOW_HOURS=4        # Janela auto-aprovação
MAX_LATE_DAYS=1                    # Máximo de dias de atraso
```

### External APIs

```bash
COORDINATE_VALIDATOR_API_URL=http://localhost:8080 # GPS Anti-fraude
FACE_RECOGNITION_API_URL=http://localhost:8081     # Reconhecimento facial
```

### Logs

```bash
LOG_LEVEL=info                     # Nível de log
LOG_FORMAT=combined                # Formato do Morgan
```

---

## 📈 Monitoramento

### Health Checks

- **Liveness**: `GET /health/live`
- **Readiness**: `GET /health/ready`  
- **Full Health**: `GET /health`

### Métricas

```json
{
  "status": "healthy",
  "uptime": 3600,
  "checks": {
    "database": "connected",
    "memory": {
      "used": "45MB", 
      "percentage": 12
    },
    "cpu": {
      "usage": 8
    }
  }
}
```

---

## 🔄 Event-Driven Architecture com RabbitMQ

### **Arquitetura Orientada a Eventos**

```
┌─────────────────┐    events     ┌─────────────────┐    events     ┌─────────────────┐
│   User Service  │──────────────▶│    RabbitMQ     │──────────────▶│ Attendance Svc  │
└─────────────────┘               │   Message       │               └─────────────────┘
                                  │    Broker       │                        │
┌─────────────────┐    events     │                 │    events     ┌─────────────────┐
│  Shift Service  │──────────────▶│                 │◀──────────────│  Redis Cache    │
└─────────────────┘               └─────────────────┘               └─────────────────┘
```

### **Fluxo de Comunicação**

1. **User/Shift Services** publicam eventos (created, updated, deleted)
2. **RabbitMQ** roteia eventos para filas específicas
3. **Attendance Service** consome eventos e atualiza cache local
4. **Attendance Service** publica eventos próprios (attendance.recorded, approved, rejected)

### **Event Types e Routing Keys**

| Service | Event Type | Routing Key | Queue |
|---------|------------|-------------|--------|
| User Service | `user.created` | `user.created` | `attendance.user.sync` |
| User Service | `user.updated` | `user.updated` | `attendance.user.sync` |
| Shift Service | `shift.created` | `shift.created` | `attendance.shift.sync` |
| Shift Service | `shift.updated` | `shift.updated` | `attendance.shift.sync` |
| **Attendance Service** | `attendance.recorded` | `attendance.recorded` | `shift.attendance.updates` |
| **Attendance Service** | `attendance.approved` | `attendance.approved` | `shift.attendance.updates` |

### **RabbitMQ Configuration**

```bash
# Exchanges
attendance.events    # Eventos do Attendance Service
shift.events        # Eventos do Shift Service  
user.events         # Eventos do User Service

# Queues
attendance.commands      # Comandos para o Attendance
attendance.shift.sync   # Sincronização de Shifts
attendance.user.sync    # Sincronização de Users

# Management UI
http://localhost:15672  # admin:admin
```

### **Cache Strategy**

```typescript
// 1. Receber evento via RabbitMQ
const shiftEvent = await consumeShiftEvent();

// 2. Atualizar cache Redis  
await shiftCacheService.cacheShift(shiftEvent.data);

// 3. Usar dados do cache nas operações
const shift = await shiftCacheService.getShiftFromCache(shiftId);
```

### **Event Publishing**

```typescript
// Publicar evento após registrar attendance
await attendanceEventPublisher.publishAttendanceRecorded({
  attendanceId: attendance.id,
  shiftId: attendance.shiftId,
  doctorId: attendance.doctorId,
  type: attendance.type,
  timestamp: attendance.timestamp,
  status: attendance.status,
  // ... outros dados
});
```

---

## 🚀 Próximos Passos

### Fase 1 - Core Implementation
- [ ] Migrar Facade e Strategy Patterns
- [ ] Integrar Services no Controller
- [ ] Implementar HTTP Client para outros microserviços
- [ ] Migrar todos os testes Jest

### Fase 2 - Advanced Features  
- [ ] Redis para cache
- [ ] Rate limiting
- [ ] API Gateway integration
- [ ] Distributed tracing
- [ ] Prometheus metrics

### Fase 3 - Production Ready
- [ ] CI/CD pipeline
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation completa

---

## 📄 Licença

MIT License - MedicBank Team

---

## 💡 Contribuindo

1. Fork o projeto
2. Crie uma feature branch
3. Implemente seguindo os Design Patterns
4. Adicione testes adequados
5. Commit com mensagens claras
6. Abra um Pull Request

---

**🏥 Attendance Service v1.0.0** - Construído com ❤️ e Design Patterns profissionais!
